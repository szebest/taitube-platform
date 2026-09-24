import { inProcessAppConfig } from '@vp/env-schema';
import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { contracts, endpointKey, isEndpoint } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import { composeApp } from '../app';

/** Mounted by third-party plugins (@fastify/swagger, Scalar, Bull Board), not by this repo. */
const VENDOR_PREFIXES = ['/docs', '/openapi.json', '/admin/queues'];

const ENDPOINTS = Object.values(contracts).flatMap((group) =>
  Object.values(group).filter(isEndpoint)
);

const ENDPOINT_KEYS = new Set(
  ENDPOINTS.map((endpoint) => endpointKey(endpoint.method, endpoint.path))
);

const UNVERSIONED_PATHS = new Set(
  ENDPOINTS.filter((endpoint) => !endpoint.path.startsWith('/v1/')).map((endpoint) => endpoint.path)
);

interface RegisteredRoute {
  method: string;
  path: string;
}

const CONNECTOR = '── ';
const INDENT_WIDTH = 4;

/**
 * Reads `printRoutes({ commonPrefix: false })` one line at a time: each line is a tree connector,
 * then a path fragment, then its methods in parentheses. That is the only public view of every
 * registered route; `composeApp` mounts the routes before a spec could attach an `onRoute` hook.
 */
function registeredRoutes(tree: string): RegisteredRoute[] {
  const routes: RegisteredRoute[] = [];
  const pathAtDepth: string[] = [];

  for (const line of tree.split('\n')) {
    const connectorAt = line.indexOf(CONNECTOR);
    if (connectorAt === -1) continue;

    const depth = (connectorAt - 1) / INDENT_WIDTH;
    const node = line.slice(connectorAt + CONNECTOR.length);
    const [fragment = '', methodList] = node.split(' (');
    const parentPath = depth === 0 ? '' : (pathAtDepth[depth - 1] ?? '');
    const path = parentPath + fragment;
    pathAtDepth[depth] = path;

    if (methodList === undefined || path.includes('*')) continue;
    const methods = methodList.replace(')', '').split(', ');
    for (const method of methods) {
      if (method === 'HEAD' || method === 'OPTIONS') continue;
      routes.push({ method, path });
    }
  }

  return routes;
}

/** `/videos/:id` is the unversioned alias of `/v1/videos/:id`; probes carry no version. */
function canonicalPaths(path: string): string[] {
  const isCanonical = path.startsWith('/v1/') || UNVERSIONED_PATHS.has(path);
  const versioned = isCanonical ? path : `/v1${path}`;

  let candidates = [''];
  for (const segment of versioned.split('/').slice(1)) {
    const options = segment.split('|');
    candidates = candidates.flatMap((prefix) => options.map((option) => `${prefix}/${option}`));
  }
  return candidates;
}

describe('apps/api: contract drift', () => {
  let app: FastifyInstance;
  let registered: RegisteredRoute[];
  let spec: {
    paths: Record<
      string,
      Record<string, { summary?: string; description?: string; tags?: string[] }>
    >;
  };

  beforeAll(async () => {
    app = (
      await composeApp({
        config: inProcessAppConfig(),
        adapters: {
          repositories: new InMemoryRepositories(),
          cache: new InMemoryCacheClient(),
          storage: new InMemoryStorageClient(),
        },
      })
    ).app;
    await app.ready();
    registered = registeredRoutes(app.printRoutes({ commonPrefix: false }));
    spec = app.swagger() as typeof spec;
  });

  afterAll(async () => {
    await app.close();
  });

  it('finds the routes it is meant to police', () => {
    expect(registered.length).toBeGreaterThan(ENDPOINTS.length);
    expect(registered).toContainEqual({ method: 'GET', path: '/v1/feed' });
    expect(registered).toContainEqual({ method: 'PUT', path: '/v1/videos/:id/reactions' });
  });

  it('has an @vp/api-contracts entry for every registered route', () => {
    const undeclared = registered
      .filter(({ path }) => !VENDOR_PREFIXES.some((prefix) => path.startsWith(prefix)))
      .filter(
        ({ method, path }) =>
          !canonicalPaths(path).some((candidate) =>
            ENDPOINT_KEYS.has(endpointKey(method, candidate))
          )
      )
      .map(({ method, path }) => endpointKey(method, path));

    expect(undeclared).toEqual([]);
  });

  it('routes every endpoint the contract promises', () => {
    const unrouted = ENDPOINTS.filter(
      (endpoint) => !app.hasRoute({ method: endpoint.method, url: endpoint.path })
    ).map((endpoint) => endpointKey(endpoint.method, endpoint.path));

    expect(unrouted).toEqual([]);
  });

  it('documents each endpoint with the contract prose, not a parallel copy', () => {
    const drifted = ENDPOINTS.filter((endpoint) => {
      const documentedPath = endpoint.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
      const operation = spec.paths[documentedPath]?.[endpoint.method.toLowerCase()];
      return (
        !operation ||
        operation.summary !== endpoint.summary ||
        operation.description !== endpoint.description ||
        operation.tags?.[0] !== endpoint.tag
      );
    }).map((endpoint) => endpointKey(endpoint.method, endpoint.path));

    expect(drifted).toEqual([]);
  });
});

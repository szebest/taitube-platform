import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { API_ENDPOINTS, endpointKey, findEndpoint } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';

/** Mounted by third-party plugins (@fastify/swagger, Scalar, Bull Board), not by this repo. */
const VENDOR_PREFIXES = ['/docs', '/openapi.json', '/admin/queues'];

const UNVERSIONED_PATHS = new Set(
  API_ENDPOINTS.filter((endpoint) => !endpoint.path.startsWith('/v1/')).map(
    (endpoint) => endpoint.path
  )
);

interface RegisteredRoute {
  method: string;
  path: string;
}

/**
 * Rebuilds the route table from `printRoutes`, which is the only public view of
 * every registered route — `findRoute` hands back a handler without its schema,
 * and an `onRoute` hook cannot be attached before `buildApp` mounts the routes.
 */
function parseRouteTree(tree: string): RegisteredRoute[] {
  const routes: RegisteredRoute[] = [];
  const pathByDepth: string[] = [];

  for (const line of tree.split('\n')) {
    const match = /^((?:[│ ] {3})*)(?:[├└]── )(.*)$/.exec(line);
    if (!match) continue;

    const [, indent = '', node = ''] = match;
    const depth = indent.length / 4;
    const [, fragment = '', methodList] = /^(.*?)(?: \(([A-Z, ]+)\))?$/.exec(node) ?? [];

    pathByDepth[depth] = (depth === 0 ? '' : (pathByDepth[depth - 1] ?? '')) + fragment;
    pathByDepth.length = depth + 1;

    const path = pathByDepth[depth];
    if (!(methodList && path) || path.includes('*')) continue;

    for (const method of methodList.split(', ')) {
      if (method === 'HEAD' || method === 'OPTIONS') continue;
      routes.push({ method, path });
    }
  }

  return routes;
}

/** `/videos/:id` is the unversioned alias of `/v1/videos/:id`; probes carry no version. */
function canonicalPaths(path: string): string[] {
  const versioned =
    path.startsWith('/v1/') || UNVERSIONED_PATHS.has(path) ? [path] : [`/v1${path}`];

  return versioned.flatMap((candidate) =>
    candidate
      .split('/')
      .slice(1)
      .reduce<string[]>(
        (prefixes, segment) =>
          prefixes.flatMap((prefix) => segment.split('|').map((option) => `${prefix}/${option}`)),
        ['']
      )
  );
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
    app = await buildApp({
      adapters: {
        repositories: new InMemoryRepositories(),
        cache: new InMemoryCacheClient(),
        storage: new InMemoryStorageClient(),
      },
    });
    await app.ready();
    registered = parseRouteTree(app.printRoutes({ commonPrefix: false }));
    spec = app.swagger() as typeof spec;
  });

  afterAll(async () => {
    await app.close();
  });

  it('finds the routes it is meant to police', () => {
    expect(registered.length).toBeGreaterThan(API_ENDPOINTS.length);
    expect(registered).toContainEqual({ method: 'GET', path: '/v1/feed' });
    expect(registered).toContainEqual({ method: 'PUT', path: '/v1/videos/:id/reactions' });
  });

  it('has an @vp/api-contracts entry for every registered route', () => {
    const undeclared = registered
      .filter(({ path }) => !VENDOR_PREFIXES.some((prefix) => path.startsWith(prefix)))
      .filter(
        ({ method, path }) =>
          !canonicalPaths(path).some((candidate) => findEndpoint(method, candidate))
      )
      .map(({ method, path }) => endpointKey(method, path));

    expect(undeclared).toEqual([]);
  });

  it('routes every endpoint the contract promises', () => {
    const unrouted = API_ENDPOINTS.filter(
      (endpoint) => !app.hasRoute({ method: endpoint.method, url: endpoint.path })
    ).map((endpoint) => endpointKey(endpoint.method, endpoint.path));

    expect(unrouted).toEqual([]);
  });

  it('documents each endpoint with the contract prose, not a parallel copy', () => {
    const drifted = API_ENDPOINTS.filter((endpoint) => {
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

import diagnostics from 'node:diagnostics_channel';
import { contracts, endpointKey, isEndpoint } from '@vp/api-contracts';
import type { FastifyInstance, RouteOptions } from 'fastify';
import { z } from 'zod';
import { buildTestApp } from './test-app';

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

const IMPLICIT_METHODS = new Set(['HEAD', 'OPTIONS']);

const FastifyInitialization = z.object({
  fastify: z.custom<FastifyInstance>((value) => typeof value === 'object' && value !== null),
});

function asRoutes(route: RouteOptions): RegisteredRoute[] {
  const methods = Array.isArray(route.method) ? route.method : [route.method];
  if (route.url.includes('*')) return [];
  return methods
    .filter((method) => !IMPLICIT_METHODS.has(method))
    .map((method) => ({ method, path: route.url }));
}

/**
 * Every route Fastify registers, as `onRoute` reports it. The hook goes on through Fastify's
 * `fastify.initialization` channel, which fires as `composeApp` creates the instance and before it
 * mounts a single route.
 */
async function composeRecordingRoutes(): Promise<{
  app: FastifyInstance;
  routes: RegisteredRoute[];
}> {
  const routes: RegisteredRoute[] = [];
  const onRoute = (route: RouteOptions) => {
    routes.push(...asRoutes(route));
  };
  const attach = (message: unknown) => {
    const { fastify } = FastifyInitialization.parse(message);
    fastify.addHook('onRoute', onRoute);
  };
  diagnostics.subscribe('fastify.initialization', attach);
  const { app } = await buildTestApp();
  diagnostics.unsubscribe('fastify.initialization', attach);
  return { app, routes };
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
    ({ app, routes: registered } = await composeRecordingRoutes());
    await app.ready();
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

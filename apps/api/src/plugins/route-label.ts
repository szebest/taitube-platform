import type { FastifyRequest } from 'fastify';

/** What no route matched is recorded as: the raw URL would give every probed path a series. */
const UNMATCHED_ROUTE = 'unmatched';

export function routeLabel(request: FastifyRequest): string {
  return request.routeOptions.url ?? UNMATCHED_ROUTE;
}

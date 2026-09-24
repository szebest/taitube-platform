import type { FastifyRequest } from 'fastify';
import { UNMATCHED_ROUTE, routeLabel } from '../route-label';

const requestFor = (url: string | undefined) => ({ routeOptions: { url } }) as FastifyRequest;

describe('apps/api/plugins: routeLabel', () => {
  it('names a request by the route template it matched', () => {
    expect(routeLabel(requestFor('/v1/videos/:id'))).toBe('/v1/videos/:id');
  });

  it('names a request no route matched as unmatched', () => {
    expect(routeLabel(requestFor(undefined))).toBe(UNMATCHED_ROUTE);
  });
});

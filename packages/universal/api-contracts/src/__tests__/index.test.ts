import { isEndpoint } from '../endpoint';
import { contracts, endpointKey } from '../index';

const endpoints = Object.values(contracts).flatMap((group) =>
  Object.values(group).filter(isEndpoint)
);

describe('packages/api-contracts: registry', () => {
  it('keys an endpoint by upper-cased method and path', () => {
    expect(endpointKey('get', '/v1/feed')).toBe('GET /v1/feed');
  });

  it('holds no duplicate method and path pair', () => {
    const keys = endpoints.map((endpoint) => endpointKey(endpoint.method, endpoint.path));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('versions every endpoint except the ops probes', () => {
    const unversioned = endpoints.filter((endpoint) => !endpoint.path.startsWith('/v1/'));
    expect(unversioned.map((endpoint) => endpoint.path).sort()).toEqual([
      '/.well-known/jwks.json',
      '/healthz',
      '/livez',
      '/readyz',
    ]);
  });
});

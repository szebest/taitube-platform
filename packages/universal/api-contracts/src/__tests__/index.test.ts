import { API_ENDPOINTS, contracts, endpointKey, findEndpoint } from '../index';

describe('packages/api-contracts: registry', () => {
  it('flattens every route group into one endpoint list', () => {
    expect(API_ENDPOINTS.length).toBe(
      Object.values(contracts).reduce(
        (total, group) =>
          total +
          Object.values(group).filter(
            (value) => typeof value === 'object' && value !== null && 'path' in value
          ).length,
        0
      )
    );
  });

  it('keys an endpoint by method and path', () => {
    expect(endpointKey('get', '/v1/feed')).toBe('GET /v1/feed');
    expect(findEndpoint('GET', '/v1/feed')).toBe(contracts.feed.getFeed);
    expect(findEndpoint('POST', '/v1/feed')).toBeUndefined();
  });

  it('holds no duplicate method and path pair', () => {
    const keys = API_ENDPOINTS.map((endpoint) => endpointKey(endpoint.method, endpoint.path));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('versions every endpoint except the ops probes', () => {
    const unversioned = API_ENDPOINTS.filter((endpoint) => !endpoint.path.startsWith('/v1/'));
    expect(unversioned.map((endpoint) => endpoint.path).sort()).toEqual([
      '/.well-known/jwks.json',
      '/healthz',
      '/livez',
      '/readyz',
    ]);
  });
});

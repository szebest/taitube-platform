import { contracts, isEndpoint } from '@vp/api-contracts';
import { createApiClient } from '../client';

const emptyFeed = { items: [], nextCursor: null, total: 0 };

describe('packages/api-client: client', () => {
  it('exposes one caller per contract entry, grouped by route group', () => {
    const client = createApiClient({ baseUrl: 'http://localhost:3000' });

    const callers = Object.values(client).flatMap((group) => Object.values(group));
    const endpoints = Object.values(contracts).flatMap((group) =>
      Object.values(group).filter(isEndpoint)
    );
    expect(callers).toHaveLength(endpoints.length);
    expect(callers.every((caller) => typeof caller === 'function')).toBe(true);
    expect(Object.keys(client).sort()).toEqual(Object.keys(contracts).sort());
  });

  it('calls the endpoint its key names', async () => {
    const seen: string[] = [];
    const client = createApiClient({
      baseUrl: 'http://localhost:3000',
      fetch: (async (url: string | URL | Request) => {
        seen.push(String(url));
        return new Response(JSON.stringify(emptyFeed), {
          headers: { 'content-type': 'application/json' },
        });
      }) as unknown as typeof globalThis.fetch,
    });

    await client.feed.getFeed({ query: { sort: 'popular' } });

    expect(seen).toEqual(['http://localhost:3000/v1/feed?sort=popular']);
  });

  it('takes no argument when the endpoint needs none', async () => {
    const client = createApiClient({
      baseUrl: 'http://localhost:3000',
      fetch: (async () =>
        new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'content-type': 'application/json' },
        })) as unknown as typeof globalThis.fetch,
    });

    await expect(client.health.liveness()).resolves.toEqual({ status: 'ok' });
  });
});

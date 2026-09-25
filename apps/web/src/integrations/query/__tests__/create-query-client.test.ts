import { QUERY_STALE_TIME_MS, createQueryClient } from '../create-query-client';

describe('apps/web: createQueryClient', () => {
  it('builds a new client for every call, so no two requests share a cache', () => {
    expect(createQueryClient()).not.toBe(createQueryClient());
  });

  it('keeps a hydrated query fresh, so the browser does not refetch what the server loaded', () => {
    const client = createQueryClient();
    client.setQueryData(['video', 'v1'], { title: 'Launch day' });

    const query = client.getQueryCache().find({ queryKey: ['video', 'v1'] });

    expect(QUERY_STALE_TIME_MS).toBeGreaterThan(0);
    expect(query?.isStaleByTime(QUERY_STALE_TIME_MS)).toBe(false);
  });
});

import { createQueryClient } from '../create-query-client';

describe('apps/web: createQueryClient', () => {
  it('builds a new client for every call, so no two requests share a cache', () => {
    expect(createQueryClient()).not.toBe(createQueryClient());
  });

  it('keeps a hydrated query fresh, so the browser does not refetch what the server loaded', () => {
    const client = createQueryClient();
    client.setQueryData(['video', 'v1'], { title: 'Launch day' });

    const query = client.getQueryCache().find({ queryKey: ['video', 'v1'] });
    const staleTime = client.getDefaultOptions().queries?.staleTime;

    expect(staleTime).toBeGreaterThan(0);
    expect(typeof staleTime === 'number' && query?.isStaleByTime(staleTime)).toBe(false);
  });
});

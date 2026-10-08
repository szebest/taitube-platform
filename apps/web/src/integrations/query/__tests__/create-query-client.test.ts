import { ApiError } from '@vp/api-client';
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

  it.each([
    { failure: 'a 401', error: new ApiError(401, 'UNAUTHORIZED', 'x'), count: 0, retries: false },
    {
      failure: 'a 404',
      error: new ApiError(404, 'VIDEO_NOT_FOUND', 'x'),
      count: 0,
      retries: false,
    },
    { failure: 'a first 503', error: new ApiError(503, 'INTERNAL', 'x'), count: 0, retries: true },
    { failure: 'a third 503', error: new ApiError(503, 'INTERNAL', 'x'), count: 3, retries: false },
    {
      failure: 'a dropped connection',
      error: new TypeError('Failed to fetch'),
      count: 0,
      retries: true,
    },
  ])('retries $failure: $retries', ({ error, count, retries }) => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry;

    expect(typeof retry === 'function' && retry(count, error)).toBe(retries);
  });
});

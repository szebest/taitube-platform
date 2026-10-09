import { queryOptions } from '@tanstack/react-query';
import { isNotFound } from '@tanstack/react-router';
import { ApiError } from '@vp/api-client';
import { createQueryClient } from '../create-query-client';
import { ensureFound } from '../ensure-found';

function failingWith(thrown: Error) {
  return queryOptions({
    queryKey: ['failing', thrown.message],
    queryFn: async (): Promise<string> => {
      throw thrown;
    },
    retry: false,
  });
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  const settled = await Promise.allSettled([promise]);
  return settled[0]?.status === 'rejected' ? settled[0].reason : undefined;
}

describe('apps/client/web: ensureFound', () => {
  it('loads once and serves the cached copy after that', async () => {
    const queryFn = vi.fn(async () => 'Launch day');
    const options = queryOptions({ queryKey: ['found'], queryFn });
    const queryClient = createQueryClient();

    await ensureFound(queryClient, options);
    const again = await ensureFound(queryClient, options);

    expect(again).toBe('Launch day');
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('turns a 404 into the not-found page', async () => {
    const missing = failingWith(new ApiError(404, 'VIDEO_NOT_FOUND', 'Missing'));

    expect(isNotFound(await rejection(ensureFound(createQueryClient(), missing)))).toBe(true);
  });

  it.each([
    { failure: 'a server error', thrown: new ApiError(500, 'INTERNAL_ERROR', 'Boom') },
    { failure: 'a transport failure', thrown: new TypeError('Failed to fetch') },
  ])('leaves $failure to the error page', async ({ thrown }) => {
    const rejected = await rejection(ensureFound(createQueryClient(), failingWith(thrown)));

    expect(rejected).toBe(thrown);
  });
});

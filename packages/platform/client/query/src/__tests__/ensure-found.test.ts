import { queryOptions, QueryClient } from '@tanstack/react-query';
import { isNotFound } from '@tanstack/react-router';
import { createEnsureFound } from '../ensure-found';

class Missing extends Error {}

const ensureFound = createEnsureFound((error) => error instanceof Missing);

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

describe('@kit/query: createEnsureFound', () => {
  it('loads once and serves the cached copy after that', async () => {
    const queryFn = vi.fn(async () => 'Launch day');
    const options = queryOptions({ queryKey: ['found'], queryFn });
    const queryClient = new QueryClient();

    await ensureFound(queryClient, options);
    const again = await ensureFound(queryClient, options);

    expect(again).toBe('Launch day');
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('turns the failure the app calls missing into the not-found page', async () => {
    const rejected = await rejection(
      ensureFound(new QueryClient(), failingWith(new Missing('gone')))
    );

    expect(isNotFound(rejected)).toBe(true);
  });

  it('leaves any other failure to the error page', async () => {
    const thrown = new TypeError('Failed to fetch');

    const rejected = await rejection(ensureFound(new QueryClient(), failingWith(thrown)));

    expect(rejected).toBe(thrown);
  });
});

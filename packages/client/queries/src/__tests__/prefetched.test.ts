import { queryOptions } from '@tanstack/react-query';
import { createQueryClient } from '../create-query-client';
import { prefetched } from '../prefetched';

describe('@vp/queries: prefetched', () => {
  it('warms the cache and resolves to nothing', async () => {
    const options = queryOptions({ queryKey: ['warm'], queryFn: async () => 'ready' });
    const queryClient = createQueryClient();

    await expect(prefetched(queryClient.query(options))).resolves.toBeUndefined();

    expect(queryClient.getQueryData(options.queryKey)).toBe('ready');
  });

  it('swallows a failed load', async () => {
    const options = queryOptions({
      queryKey: ['cold'],
      queryFn: async (): Promise<string> => {
        throw new Error('down');
      },
      retry: false,
    });
    const queryClient = createQueryClient();

    await expect(prefetched(queryClient.query(options))).resolves.toBeUndefined();

    expect(queryClient.getQueryData(options.queryKey)).toBeUndefined();
  });
});

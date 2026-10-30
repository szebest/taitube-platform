import { renderHook, waitFor } from '@testing-library/react';
import { CACHE_NAMES } from '#app/sw/cache-names';
import { useOfflineCache } from '../use-offline-cache';

describe('apps/client/web: useOfflineCache', () => {
  it('is empty where the browser has no CacheStorage', () => {
    const { result } = renderHook(() => useOfflineCache());

    expect(result.current).toEqual({ feedPages: 0 });
  });

  it('reads what the worker cached once mounted', async () => {
    vi.stubGlobal('caches', {
      has: async (name: string) => name === CACHE_NAMES.api,
      open: async () => ({ keys: async () => ['a', 'b', 'c'] }),
    });

    const { result } = renderHook(() => useOfflineCache());

    await waitFor(() => expect(result.current).toEqual({ feedPages: 3 }));
  });

  it('stays empty when the cache cannot be read', async () => {
    const has = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('caches', { has, open: vi.fn() });

    const { result } = renderHook(() => useOfflineCache());

    await waitFor(() => expect(has).toHaveBeenCalled());
    expect(result.current).toEqual({ feedPages: 0 });
  });
});

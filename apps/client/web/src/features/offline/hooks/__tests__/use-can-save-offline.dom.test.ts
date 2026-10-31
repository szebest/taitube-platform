import { renderHook } from '@testing-library/react';
import { fakeCacheStorage } from '#app/__tests__/fake-cache-storage';
import { supportOffline } from '#app/__tests__/offline-support';
import { useCanSaveOffline } from '../use-can-save-offline';

describe('apps/client/web: useCanSaveOffline', () => {
  it('is true where the browser has CacheStorage and service workers', () => {
    supportOffline(fakeCacheStorage());

    expect(renderHook(() => useCanSaveOffline()).result.current).toBe(true);
  });

  it.each([
    { name: 'CacheStorage', stub: () => vi.stubGlobal('caches', undefined) },
    { name: 'service workers', stub: () => supportOffline(fakeCacheStorage()), without: true },
  ])('is false without $name', ({ stub, without }) => {
    stub();
    if (without) {
      Reflect.deleteProperty(navigator, 'serviceWorker');
    }

    expect(renderHook(() => useCanSaveOffline()).result.current).toBe(false);
  });
});

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { registerBackgroundSync } from '#app/sw/background-sync';
import { CACHE_NAMES } from '#app/sw/cache-names';
import { registerRuntimeCaching } from '#app/sw/runtime-caching';

vi.mock(import('workbox-precaching'), () => ({
  cleanupOutdatedCaches: vi.fn(),
  matchPrecache: vi.fn(),
  precacheAndRoute: vi.fn(),
}));
vi.mock(import('workbox-routing'), () => ({ registerRoute: vi.fn(), setCatchHandler: vi.fn() }));
vi.mock(import('workbox-strategies'), () => ({ NetworkOnly: vi.fn() }));
vi.mock(import('#app/sw/background-sync'), () => ({ registerBackgroundSync: vi.fn() }));
vi.mock(import('#app/sw/runtime-caching'), () => ({ registerRuntimeCaching: vi.fn() }));

type Listener = (event: {
  data?: { type: string };
  waitUntil?: (work: Promise<unknown>) => void;
}) => void;

async function startWorker(caches: string[] = []) {
  const listeners = new Map<string, Listener>();
  const scope = {
    __WB_MANIFEST: [{ url: '/offline/', revision: 'r1' }],
    location: { origin: 'https://taitube.test' },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
    caches: { keys: vi.fn().mockResolvedValue(caches), delete: vi.fn().mockResolvedValue(true) },
  };
  vi.stubGlobal('self', scope);
  vi.stubGlobal('BroadcastChannel', class {});
  vi.resetModules();
  await import('../sw');
  return { listeners, scope };
}

describe('apps/client/web: service worker', () => {
  it('precaches the build, cleans old precaches, caches at runtime and falls back to the offline page', async () => {
    const { scope } = await startWorker();

    expect(precacheAndRoute).toHaveBeenCalledWith(scope.__WB_MANIFEST);
    expect(cleanupOutdatedCaches).toHaveBeenCalled();
    expect(registerRuntimeCaching).toHaveBeenCalledWith('https://taitube.test');
    expect(registerBackgroundSync).toHaveBeenCalledWith('https://taitube.test', expect.anything());
    expect(registerRoute).toHaveBeenCalledTimes(1);
    expect(setCatchHandler).toHaveBeenCalledTimes(1);
  });

  it('waits to take over until the viewer asks, and only for that message', async () => {
    const { listeners, scope } = await startWorker();

    listeners.get('message')?.({ data: { type: 'OTHER' } });

    expect(scope.skipWaiting).not.toHaveBeenCalled();

    listeners.get('message')?.({ data: { type: 'SKIP_WAITING' } });

    expect(scope.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('claims its clients and deletes the caches of earlier versions on activate', async () => {
    const { listeners, scope } = await startWorker([CACHE_NAMES.api, 'taitube-api-v0']);
    const work: Promise<unknown>[] = [];

    listeners.get('activate')?.({ waitUntil: (promise) => work.push(promise) });
    await Promise.all(work);

    expect(scope.caches.delete.mock.calls).toEqual([['taitube-api-v0']]);
    expect(scope.clients.claim).toHaveBeenCalled();
  });
});

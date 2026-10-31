afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

/** Gives the page a service worker API and `storage` as its CacheStorage, as a browser that can save offline has. */
export function supportOffline(storage: object) {
  vi.stubGlobal('caches', storage);
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
}

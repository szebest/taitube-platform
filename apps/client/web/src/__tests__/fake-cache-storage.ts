const BASE = 'https://taitube.test';

function keyOf(input: RequestInfo | URL): string {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, BASE).href;
}

interface FakeOptions {
  failPut?: (url: string) => Error | undefined;
}

/** A CacheStorage that holds responses in memory, with `failPut` to make a write throw. */
export function fakeCacheStorage({ failPut }: FakeOptions = {}) {
  const stores = new Map<string, Map<string, Response>>();

  const storeOf = (name: string) => {
    const existing = stores.get(name);
    if (existing) {
      return existing;
    }
    const created = new Map<string, Response>();
    stores.set(name, created);
    return created;
  };

  const cacheOf = (name: string) => {
    const store = storeOf(name);
    return {
      match: async (input: RequestInfo | URL) => store.get(keyOf(input))?.clone(),
      put: async (input: RequestInfo | URL, response: Response) => {
        const error = failPut?.(keyOf(input));
        if (error) {
          throw error;
        }
        store.set(keyOf(input), response);
      },
      delete: async (input: RequestInfo | URL) => store.delete(keyOf(input)),
      keys: async () => [...store.keys()].map((url) => new Request(url)),
    };
  };

  return {
    has: async (name: string) => stores.has(name),
    open: async (name: string) => cacheOf(name),
    match: async (input: RequestInfo | URL, options?: { cacheName?: string }) =>
      options?.cacheName ? cacheOf(options.cacheName).match(input) : undefined,
    held: (name: string) => [...(stores.get(name)?.keys() ?? [])],
  };
}

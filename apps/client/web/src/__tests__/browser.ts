import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from '../config';

export type BrowserState = {
  token?: string;
  stored?: Record<string, string>;
};

/** The few `window` members the app reads while rendering, so a spec needs no DOM environment. */
export function stubBrowser({ token, stored = {} }: BrowserState = {}): Map<string, string> {
  const storage = new Map(Object.entries(stored));
  if (token) storage.set(AUTH_TOKEN_LOCAL_STORAGE_KEY, token);

  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  });

  return storage;
}

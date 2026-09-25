import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from '../config';

export type BrowserState = {
  token?: string;
  prefersDark?: boolean;
  stored?: Record<string, string>;
};

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** The few `window` members the app reads while rendering, so a spec needs no DOM environment. */
export function stubBrowser({
  token,
  prefersDark = false,
  stored = {},
}: BrowserState = {}): Map<string, string> {
  const storage = new Map(Object.entries(stored));
  if (token) storage.set(AUTH_TOKEN_LOCAL_STORAGE_KEY, token);

  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    matchMedia: (query: string) => ({ matches: prefersDark && query === DARK_SCHEME_QUERY }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  });

  return storage;
}

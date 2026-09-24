import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from '../config';

export type BrowserState = {
  token?: string;
  prefersDark?: boolean;
};

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** The few `window` members the app reads while rendering, so a spec needs no DOM environment. */
export function stubBrowser({ token, prefersDark = false }: BrowserState = {}): void {
  const stored = new Map<string, string>();
  if (token) stored.set(AUTH_TOKEN_LOCAL_STORAGE_KEY, token);

  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      removeItem: (key: string) => stored.delete(key),
    },
    matchMedia: (query: string) => ({ matches: prefersDark && query === DARK_SCHEME_QUERY }),
  });
}

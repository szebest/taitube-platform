/**
 * The few `window` members an app reads while rendering on the server (`localStorage`, the storage
 * event listeners), so a node spec needs no DOM environment. Returns the storage, for a spec to read
 * back what the page stored.
 */
export function stubBrowser(stored: Readonly<Record<string, string>> = {}): Map<string, string> {
  const storage = new Map(Object.entries(stored));

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

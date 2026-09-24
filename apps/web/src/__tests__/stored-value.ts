import type { Dispatch, SetStateAction } from 'react';

const storedValues = new Map<string, string>();

export function clearStoredValues(): void {
  storedValues.clear();
}

export function storeValue(key: string, value: unknown): void {
  storedValues.set(key, JSON.stringify(value));
}

/**
 * Stands in for `useLocalStorage` from `@uidotdev/usehooks`, whose server snapshot throws, so a
 * component using it can render with `renderToStaticMarkup`. A write shows on the next render.
 */
export function useStoredValue<T>(key: string, initialValue?: T): [T, Dispatch<SetStateAction<T>>] {
  const stored = storedValues.get(key);
  const value = stored === undefined ? initialValue : JSON.parse(stored);

  const setValue: Dispatch<SetStateAction<T>> = (next) => {
    const resolved = next instanceof Function ? next(value) : next;
    storeValue(key, resolved);
  };

  return [value, setValue];
}

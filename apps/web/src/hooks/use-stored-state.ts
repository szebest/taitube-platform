import { ignore, isOk, tryCatch, unwrapOr } from '@vp/result';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { z } from 'zod';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function readRaw(key: string): string | null {
  return unwrapOr(
    tryCatch(
      () => window.localStorage.getItem(key),
      (cause) => cause
    ),
    null
  );
}

function parseRaw<T>(raw: string | null, schema: z.ZodType<T>, fallback: () => T): T {
  if (raw === null) return fallback();
  const json = tryCatch(
    (): unknown => JSON.parse(raw),
    (cause) => cause
  );
  if (!isOk(json)) return fallback();
  const parsed = schema.safeParse(json.value);
  return parsed.success ? parsed.data : fallback();
}

export function readStoredState<T>(key: string, schema: z.ZodType<T>, fallback: () => T): T {
  return parseRaw(readRaw(key), schema, fallback);
}

export function writeStoredState<T>(key: string, value: T): void {
  ignore(
    tryCatch(
      () => window.localStorage.setItem(key, JSON.stringify(value)),
      (cause) => cause
    ),
    'a blocked storage partition keeps the value for this page only, which is all it can offer'
  );
  window.dispatchEvent(new Event('storage'));
}

export type StoredStateUpdate<T> = T | ((current: T) => T);

/**
 * `localStorage` state that server-renders: the server and the hydration render `serverValue`, and
 * the stored value (or `clientDefault()`, read in the browser) replaces it once the page is live.
 */
export function useStoredState<T>(
  key: string,
  schema: z.ZodType<T>,
  serverValue: T,
  clientDefault: () => T = () => serverValue
): readonly [T, (update: StoredStateUpdate<T>) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => undefined
  );

  const value = useMemo(
    () => (raw === undefined ? serverValue : parseRaw(raw, schema, clientDefault)),
    [raw, schema, serverValue, clientDefault]
  );

  const setValue = useCallback(
    (update: StoredStateUpdate<T>) => {
      const current = readStoredState(key, schema, clientDefault);
      writeStoredState(key, update instanceof Function ? update(current) : update);
    },
    [key, schema, clientDefault]
  );

  return [value, setValue];
}

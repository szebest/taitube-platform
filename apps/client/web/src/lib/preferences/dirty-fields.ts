import { ignore, isOk, tryCatch } from '@vp/result';
import { z } from 'zod';

const DIRTY_KEY = 'vp.prefs.dirty';

const DirtySchema = z.array(z.string());

/** The setting paths (`playback.speed`) changed on this device while signed out, which a sign-in uploads and wins with. */
export function readDirty(): ReadonlySet<string> {
  const raw = tryCatch(
    () => window.localStorage.getItem(DIRTY_KEY),
    (cause) => cause
  );
  if (!(isOk(raw) && raw.value !== null)) return new Set();

  const json = tryCatch(
    (): unknown => JSON.parse(raw.value as string),
    (cause) => cause
  );
  const paths = isOk(json) ? DirtySchema.safeParse(json.value) : undefined;
  return new Set(paths?.success ? paths.data : []);
}

function write(paths: ReadonlySet<string>): void {
  ignore(
    tryCatch(
      () =>
        paths.size === 0
          ? window.localStorage.removeItem(DIRTY_KEY)
          : window.localStorage.setItem(DIRTY_KEY, JSON.stringify([...paths])),
      (cause) => cause
    ),
    'blocked storage means a sign-in cannot tell which fields were chosen here, and the account wins them all'
  );
}

export function markDirty(paths: readonly string[]): void {
  if (paths.length > 0) write(new Set([...readDirty(), ...paths]));
}

export function clearDirty(): void {
  write(new Set());
}

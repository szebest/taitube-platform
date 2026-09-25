import { tryCatch, unwrapOr } from '@vp/result';

export const LOCALE_STORAGE_KEY = 'vp.locale';

export interface BrowserEnvironment {
  readonly persistedLocale: string | undefined;
  readonly languages: readonly string[];
  readonly timeZone: string;
  readonly now: string;
}

function persistedLocale(): string | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const stored = tryCatch(
    () => localStorage.getItem(LOCALE_STORAGE_KEY),
    () => null
  );
  return unwrapOr(stored, null) ?? undefined;
}

/**
 * Everything the runtime says about the viewer, read in one place. It is the only module that may:
 * `@vp/intl` takes all of it as arguments, which is what lets a server render pass its own.
 */
export function readBrowserEnvironment(): BrowserEnvironment {
  return {
    persistedLocale: persistedLocale(),
    languages: typeof navigator === 'undefined' ? [] : navigator.languages,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: new Date().toISOString(),
  };
}

import { type Result, map, tryCatch } from '@vp/result';
import { type FormatFailure, unsupportedLocale } from './failures';

export const FALLBACK_LOCALE = 'en';

/**
 * Most specific first, ending at the fallback: `sv-FI` walks `sv-FI`, `sv`, `en`. A catalogue
 * looks a key up in each in turn, so a partial translation is useful rather than broken.
 */
export function localeChain(tag: string): Result<readonly string[], FormatFailure> {
  const parsed = tryCatch(
    () => new Intl.Locale(tag),
    () => unsupportedLocale(tag)
  );
  return map(parsed, (locale) => {
    const withScript = locale.script === undefined ? [] : [`${locale.language}-${locale.script}`];
    const candidates = [locale.baseName, ...withScript, locale.language, FALLBACK_LOCALE];
    return [...new Set(candidates)];
  });
}

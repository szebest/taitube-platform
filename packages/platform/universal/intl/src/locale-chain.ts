import { type Result, map, tryCatch } from '@kit/result';
import { type FormatFailure, unsupportedLocale } from './failures';

/**
 * Most specific first: `sv-FI` walks `sv-FI`, `sv`. A catalogue looks a key up in each in turn and
 * then in its own source locale, so a partial translation is useful rather than broken.
 */
export function localeChain(tag: string): Result<readonly string[], FormatFailure> {
  const parsed = tryCatch(
    () => new Intl.Locale(tag),
    () => unsupportedLocale(tag)
  );
  return map(parsed, (locale) => {
    const withScript = locale.script === undefined ? [] : [`${locale.language}-${locale.script}`];
    return [...new Set([locale.baseName, ...withScript, locale.language])];
  });
}

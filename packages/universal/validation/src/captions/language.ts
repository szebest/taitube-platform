import { err, ok, type Result, tryCatch } from '@vp/result';
import { type InvalidCaptionLanguage, invalidCaptionLanguage } from './failures';

/**
 * The tag in its canonical case, so `EN-us` and `en-US` name one track; it is also a path segment of
 * the track's object key.
 */
export function validateCaptionLanguage(
  field: string,
  language: string
): Result<string, InvalidCaptionLanguage> {
  const canonical = tryCatch(
    () => Intl.getCanonicalLocales(language),
    () => null
  );
  const [tag] = canonical.ok ? canonical.value : [];
  return tag ? ok(tag) : err(invalidCaptionLanguage(field, language));
}

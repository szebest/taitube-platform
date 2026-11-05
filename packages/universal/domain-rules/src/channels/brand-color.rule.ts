import { ACCENT_PATTERN } from '@vp/domain/settings';
import { err, ok, type Result } from '@vp/result';
import { type InvalidField, invalidField } from '@vp/validation';

export type InvalidBrandColor = InvalidField<{ pattern: string }>;

/**
 * Any well-formed colour is a brand colour, a hostile one too: the engine derives the accent
 * from it and steps it until every pair passes, so the rule holds the shape and nothing else.
 * Stored lowercase, as the account's accent is; `null` clears it.
 */
export function validateBrandColor(hex: string | null): Result<string | null, InvalidBrandColor> {
  if (hex === null) return ok(null);
  return ACCENT_PATTERN.test(hex)
    ? ok(hex.toLowerCase())
    : err(
        invalidField('brandColor', 'brandColor must be a #rrggbb colour', {
          pattern: ACCENT_PATTERN.source,
        })
      );
}

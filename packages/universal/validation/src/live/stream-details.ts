import { err, ok, type Result } from '@kit/result';
import { type LengthBounds, normalizePlainText, withinLength } from '@kit/validation';
import { type InvalidField, invalidLength } from '../field-failures';

export const LIVE_STREAM_DETAILS_BOUNDS = {
  title: { minLength: 0, maxLength: 100 },
  description: { minLength: 0, maxLength: 5000 },
} as const satisfies Record<string, LengthBounds>;

export interface LiveStreamDetails {
  readonly title?: string;
  readonly description?: string;
}

export type InvalidLiveStreamDetails = InvalidField<LengthBounds>;

/** A stream may go live untitled; the archive then takes its channel's name. */
export function validateLiveStreamDetails(
  details: LiveStreamDetails
): Result<LiveStreamDetails, InvalidLiveStreamDetails> {
  const normalized: Record<string, string> = {};
  for (const field of ['title', 'description'] as const) {
    const value = details[field];
    if (value === undefined) continue;
    const text = normalizePlainText(value);
    if (!withinLength(text, LIVE_STREAM_DETAILS_BOUNDS[field]))
      return err(invalidLength(field, LIVE_STREAM_DETAILS_BOUNDS[field]));
    normalized[field] = text;
  }
  return ok(normalized);
}

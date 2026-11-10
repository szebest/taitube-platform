import { type Result, err, ok } from '@vp/result';
import type { LengthBounds } from '../failures';
import { normalizePlainText, withinLength } from '../plain-text';
import { type InvalidModerationNote, invalidModerationNote } from './failures';

const MODERATION_NOTE_BOUNDS: LengthBounds = { minLength: 1, maxLength: 200 };

/** The note a moderator leaves on an action; a blank one is no note, which a visible action refuses on its own. */
export function validateModerationNote(
  note: string | undefined
): Result<string | null, InvalidModerationNote> {
  const normalized = normalizePlainText(note ?? '');
  if (normalized === '') return ok(null);
  return withinLength(normalized, MODERATION_NOTE_BOUNDS)
    ? ok(normalized)
    : err(invalidModerationNote(MODERATION_NOTE_BOUNDS));
}

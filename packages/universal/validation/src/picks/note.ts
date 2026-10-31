import { type Result, err, ok } from '@vp/result';
import { type InvalidField, type LengthBounds, invalidLength } from '../failures';
import { normalizePlainText, withinLength } from '../plain-text';

export const PICK_NOTE_MAX_LENGTH = 280;

const PICK_NOTE_BOUNDS: LengthBounds = { minLength: 1, maxLength: PICK_NOTE_MAX_LENGTH };

export type InvalidPickNote = InvalidField<LengthBounds>;

export function validatePickNote(
  note: string | null | undefined
): Result<string | null, InvalidPickNote> {
  const text = normalizePlainText(note ?? '');
  if (text === '') return ok(null);
  return withinLength(text, PICK_NOTE_BOUNDS)
    ? ok(text)
    : err(invalidLength('note', PICK_NOTE_BOUNDS));
}

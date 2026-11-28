import { type Result, err, ok } from '@kit/result';
import { type LengthBounds, normalizePlainText, withinLength } from '@kit/validation';
import { type InvalidPlaylistDetails, invalidPlaylistField } from './failures';

export const PLAYLIST_NOTE_MAX_LENGTH = 300;
export const PLAYLIST_SECTION_TITLE_MAX_LENGTH = 80;

const NOTE_BOUNDS: LengthBounds = { minLength: 0, maxLength: PLAYLIST_NOTE_MAX_LENGTH };
const SECTION_TITLE_BOUNDS: LengthBounds = {
  minLength: 1,
  maxLength: PLAYLIST_SECTION_TITLE_MAX_LENGTH,
};

/** A blank note clears it, so `null` is what is stored. */
export function validatePlaylistNote(
  note: string | null
): Result<string | null, InvalidPlaylistDetails> {
  if (note === null) return ok(null);
  const text = normalizePlainText(note);
  if (!withinLength(text, NOTE_BOUNDS)) return err(invalidPlaylistField('note', NOTE_BOUNDS));
  return ok(text === '' ? null : text);
}

export function validateSectionTitle(title: string): Result<string, InvalidPlaylistDetails> {
  const text = normalizePlainText(title);
  return withinLength(text, SECTION_TITLE_BOUNDS)
    ? ok(text)
    : err(invalidPlaylistField('title', SECTION_TITLE_BOUNDS));
}

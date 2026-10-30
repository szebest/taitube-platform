import { type Result, andThen, err, map, ok } from '@vp/result';
import type { LengthBounds } from '../failures';
import { normalizePlainText, withinLength } from '../plain-text';
import { type InvalidPlaylistDetails, invalidPlaylistField } from './failures';

const TITLE_BOUNDS: LengthBounds = { minLength: 1, maxLength: 150 };
const DESCRIPTION_BOUNDS: LengthBounds = { minLength: 0, maxLength: 5000 };

export interface PlaylistDetailsInput {
  readonly title?: string;
  readonly description?: string;
}

function normalized(
  field: 'title' | 'description',
  value: string,
  bounds: LengthBounds
): Result<string, InvalidPlaylistDetails> {
  const text = normalizePlainText(value);
  return withinLength(text, bounds) ? ok(text) : err(invalidPlaylistField(field, bounds));
}

export function validatePlaylistTitle(title: string): Result<string, InvalidPlaylistDetails> {
  return normalized('title', title, TITLE_BOUNDS);
}

export function validatePlaylistDescription(
  description: string
): Result<string, InvalidPlaylistDetails> {
  return normalized('description', description, DESCRIPTION_BOUNDS);
}

function optional(
  value: string | undefined,
  validate: (value: string) => Result<string, InvalidPlaylistDetails>
): Result<string | undefined, InvalidPlaylistDetails> {
  return value === undefined ? ok(undefined) : validate(value);
}

/** Only the fields given are checked and returned, so a partial edit stays partial. */
export function validatePlaylistDetails(
  input: PlaylistDetailsInput
): Result<PlaylistDetailsInput, InvalidPlaylistDetails> {
  return andThen(optional(input.title, validatePlaylistTitle), (title) =>
    map(optional(input.description, validatePlaylistDescription), (description) => ({
      ...(title === undefined ? {} : { title }),
      ...(description === undefined ? {} : { description }),
    }))
  );
}

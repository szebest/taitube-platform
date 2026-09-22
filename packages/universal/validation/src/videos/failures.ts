import { type InvalidField, type LengthBounds, invalidField, invalidLength } from '../failures.js';

export type InvalidVideoTitle = InvalidField<LengthBounds>;
export type InvalidVideoDescription = InvalidField<{ maxLength: number }>;

export type VideoMetadataFailure = InvalidVideoTitle | InvalidVideoDescription;

export function invalidVideoTitle(bounds: LengthBounds): InvalidVideoTitle {
  return invalidLength('title', bounds);
}

export function invalidVideoDescription(maxLength: number): InvalidVideoDescription {
  return invalidField(
    'description',
    `Description must be at most ${maxLength} characters`,
    { maxLength }
  );
}

import { type Result, andThen, err, map, ok } from '@vp/result';
import type { LengthBounds } from '../failures';
import { type VideoMetadataFailure, invalidVideoDescription, invalidVideoTitle } from './failures';

const VIDEO_TITLE_BOUNDS: LengthBounds = { minLength: 1, maxLength: 200 };
const VIDEO_DESCRIPTION_MAX_LENGTH = 5000;

export interface VideoMetadataInput {
  readonly title?: string | null;
  readonly description?: string | null;
}

function validateTitle(title: string | null | undefined): Result<unknown, VideoMetadataFailure> {
  if (title === undefined || title === null) return ok(title);
  const { minLength, maxLength } = VIDEO_TITLE_BOUNDS;
  return title.length >= minLength && title.length <= maxLength
    ? ok(title)
    : err(invalidVideoTitle(VIDEO_TITLE_BOUNDS));
}

function validateDescription(
  description: string | null | undefined
): Result<unknown, VideoMetadataFailure> {
  if (description === undefined || description === null) return ok(description);
  return description.length <= VIDEO_DESCRIPTION_MAX_LENGTH
    ? ok(description)
    : err(invalidVideoDescription(VIDEO_DESCRIPTION_MAX_LENGTH));
}

export function validateVideoMetadata(
  input: VideoMetadataInput
): Result<VideoMetadataInput, VideoMetadataFailure> {
  return andThen(validateTitle(input.title), () =>
    map(validateDescription(input.description), () => input)
  );
}

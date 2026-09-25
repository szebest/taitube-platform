import { type InvalidField, type LengthBounds, invalidField, invalidLength } from '../failures';

export type InvalidVideoTitle = InvalidField<LengthBounds>;
export type InvalidVideoDescription = InvalidField<{ maxLength: number }>;

export interface VideoTagLimits {
  readonly maxTags: number;
  readonly maxLength: number;
}

export type InvalidVideoTags = InvalidField<VideoTagLimits>;

export type VideoMetadataFailure = InvalidVideoTitle | InvalidVideoDescription | InvalidVideoTags;

export function invalidVideoTitle(bounds: LengthBounds): InvalidVideoTitle {
  return invalidLength('title', bounds);
}

export function invalidVideoDescription(maxLength: number): InvalidVideoDescription {
  return invalidField('description', `Description must be at most ${maxLength} characters`, {
    maxLength,
  });
}

export function invalidVideoTags(limits: VideoTagLimits): InvalidVideoTags {
  return invalidField(
    'tags',
    `At most ${limits.maxTags} tags, each 1 to ${limits.maxLength} characters`,
    limits
  );
}

import { ErrorCodes, type Failure } from '@vp/errors';

export type CaptionNotFound = Failure<
  typeof ErrorCodes.CAPTION_NOT_FOUND,
  { videoId: string; language: string | null }
>;

export type CaptionTrackLimit = Failure<
  typeof ErrorCodes.CAPTION_TRACK_LIMIT,
  { videoId: string; limit: number }
>;

export type CaptionOverwriteUnconfirmed = Failure<
  typeof ErrorCodes.CAPTION_OVERWRITE_UNCONFIRMED,
  { videoId: string; captionId: string }
>;

/** A run would detect a language another track already holds; the hint is refused before it starts. */
export type CaptionLanguageTaken = Failure<
  typeof ErrorCodes.VALIDATION_FAILED,
  { videoId: string; language: string }
>;

export function captionNotFound(videoId: string, language: string | null): CaptionNotFound {
  return {
    code: ErrorCodes.CAPTION_NOT_FOUND,
    message: 'The video has no such caption track',
    videoId,
    language,
  };
}

export function captionTrackLimit(videoId: string, limit: number): CaptionTrackLimit {
  return {
    code: ErrorCodes.CAPTION_TRACK_LIMIT,
    message: `A video holds at most ${limit} caption tracks`,
    videoId,
    limit,
  };
}

export function captionOverwriteUnconfirmed(
  videoId: string,
  captionId: string
): CaptionOverwriteUnconfirmed {
  return {
    code: ErrorCodes.CAPTION_OVERWRITE_UNCONFIRMED,
    message: 'Regenerating replaces the edited captions; confirm with overwrite',
    videoId,
    captionId,
  };
}

export function captionLanguageTaken(videoId: string, language: string): CaptionLanguageTaken {
  return {
    code: ErrorCodes.VALIDATION_FAILED,
    message: `Another caption track already holds ${language}`,
    videoId,
    language,
  };
}

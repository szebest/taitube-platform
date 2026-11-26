import { type Failure } from '@kit/errors';
import {
  BLUR_MAX_STRENGTH,
  BLUR_MIN_MS,
  BLUR_MIN_STRENGTH,
  MAX_BLURS,
  TRIM_MIN_MS,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { type InvalidField, invalidField } from '@vp/validation';

/** A replacement or an edit is already uploading or rendering: one at a time per video. */
export type GenerationInProgress = Failure<
  typeof ErrorCodes.GENERATION_IN_PROGRESS,
  { videoId: string }
>;

export type ReplacementNotUploaded = Failure<
  typeof ErrorCodes.REPLACEMENT_NOT_UPLOADED,
  { videoId: string; generation: number }
>;

export type NoEditToRevert = Failure<typeof ErrorCodes.NO_EDIT_TO_REVERT, { videoId: string }>;

export type InvalidVideoEdit = InvalidField<{
  readonly maxBlurs: number;
  readonly minTrimMs: number;
  readonly minBlurMs: number;
  readonly minStrength: number;
  readonly maxStrength: number;
}>;

export function generationInProgress(videoId: string): GenerationInProgress {
  return {
    code: ErrorCodes.GENERATION_IN_PROGRESS,
    message: 'A replacement or an edit of this video is already in progress',
    videoId,
  };
}

export function replacementNotUploaded(
  videoId: string,
  generation: number
): ReplacementNotUploaded {
  return {
    code: ErrorCodes.REPLACEMENT_NOT_UPLOADED,
    message: `No uploaded file waits for generation ${generation}`,
    videoId,
    generation,
  };
}

export function noEditToRevert(videoId: string): NoEditToRevert {
  return { code: ErrorCodes.NO_EDIT_TO_REVERT, message: 'No applied edit to revert', videoId };
}

export function invalidVideoEdit(field: 'trim' | 'blurs', reason: string): InvalidVideoEdit {
  return invalidField(field, reason, {
    maxBlurs: MAX_BLURS,
    minTrimMs: TRIM_MIN_MS,
    minBlurMs: BLUR_MIN_MS,
    minStrength: BLUR_MIN_STRENGTH,
    maxStrength: BLUR_MAX_STRENGTH,
  });
}

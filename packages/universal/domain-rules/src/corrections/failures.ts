import { type Failure } from '@kit/errors';
import {
  CORRECTION_MAX_MS,
  CORRECTION_MIN_MS,
  CORRECTION_TEXT_MAX_LENGTH,
  MAX_CORRECTIONS_PER_VIDEO,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { type InvalidField, invalidField } from '@vp/validation';

export type CorrectionNotFound = Failure<
  typeof ErrorCodes.CORRECTION_NOT_FOUND,
  { correctionId: string }
>;

export type CorrectionLimit = Failure<
  typeof ErrorCodes.CORRECTION_LIMIT,
  { videoId: string; limit: number }
>;

export type InvalidCorrection = InvalidField<{
  readonly minMs: number;
  readonly maxMs: number;
  readonly maxTextLength: number;
}>;

export function correctionNotFound(correctionId: string): CorrectionNotFound {
  return { code: ErrorCodes.CORRECTION_NOT_FOUND, message: 'Correction not found', correctionId };
}

export function correctionLimit(videoId: string): CorrectionLimit {
  return {
    code: ErrorCodes.CORRECTION_LIMIT,
    message: `A video has at most ${MAX_CORRECTIONS_PER_VIDEO} corrections`,
    videoId,
    limit: MAX_CORRECTIONS_PER_VIDEO,
  };
}

export function invalidCorrection(field: 'range' | 'text', reason: string): InvalidCorrection {
  return invalidField(field, reason, {
    minMs: CORRECTION_MIN_MS,
    maxMs: CORRECTION_MAX_MS,
    maxTextLength: CORRECTION_TEXT_MAX_LENGTH,
  });
}

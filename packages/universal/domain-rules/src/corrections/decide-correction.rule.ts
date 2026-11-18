import { type Result, err, ok } from '@kit/result';
import {
  CORRECTION_MAX_MS,
  CORRECTION_MIN_MS,
  CORRECTION_TEXT_MAX_LENGTH,
  MAX_CORRECTIONS_PER_VIDEO,
} from '@vp/domain';
import { normalizePlainText, withinLength } from '@vp/validation';
import {
  type CorrectionLimit,
  type InvalidCorrection,
  correctionLimit,
  invalidCorrection,
} from './failures';

export interface CorrectionInput {
  readonly startMs: number;
  readonly endMs: number;
  readonly text: string;
}

export interface CorrectionContext {
  readonly videoId: string;
  readonly durationMs: number | null;
  readonly existing: number;
}

export type DecideCorrectionFailure = InvalidCorrection | CorrectionLimit;

export function decideCorrection(
  input: CorrectionInput,
  context: CorrectionContext
): Result<CorrectionInput, DecideCorrectionFailure> {
  const length = input.endMs - input.startMs;
  const inside =
    input.startMs >= 0 && (context.durationMs === null || input.endMs <= context.durationMs);
  if (!(inside && length >= CORRECTION_MIN_MS && length <= CORRECTION_MAX_MS)) {
    return err(
      invalidCorrection(
        'range',
        `A correction runs ${CORRECTION_MIN_MS / 1000} to ${CORRECTION_MAX_MS / 1000} seconds inside the video`
      )
    );
  }
  const text = normalizePlainText(input.text);
  if (!withinLength(text, { minLength: 1, maxLength: CORRECTION_TEXT_MAX_LENGTH })) {
    return err(
      invalidCorrection('text', `The text is 1 to ${CORRECTION_TEXT_MAX_LENGTH} characters`)
    );
  }
  if (context.existing >= MAX_CORRECTIONS_PER_VIDEO) return err(correctionLimit(context.videoId));
  return ok({ startMs: input.startMs, endMs: input.endMs, text });
}

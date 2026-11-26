import { type Result, err, isErr, ok } from '@kit/result';
import { normalizePlainText, withinLength } from '@kit/validation';
import {
  CORRECTION_MAX_MS,
  CORRECTION_MIN_MS,
  CORRECTION_TEXT_MAX_LENGTH,
  MAX_CORRECTIONS_PER_VIDEO,
} from '@vp/domain';
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

export interface CorrectionFieldsContext {
  readonly durationMs: number | null;
}

export interface CorrectionContext extends CorrectionFieldsContext {
  readonly videoId: string;
  readonly existing: number;
}

export type DecideCorrectionFailure = InvalidCorrection | CorrectionLimit;

/** The range and the text of a correction, with the limit left to the caller: an edit adds no card. */
export function decideCorrectionFields(
  input: CorrectionInput,
  context: CorrectionFieldsContext
): Result<CorrectionInput, InvalidCorrection> {
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
  return ok({ startMs: input.startMs, endMs: input.endMs, text });
}

export function decideCorrection(
  input: CorrectionInput,
  context: CorrectionContext
): Result<CorrectionInput, DecideCorrectionFailure> {
  const decided = decideCorrectionFields(input, context);
  if (isErr(decided)) return decided;
  if (context.existing >= MAX_CORRECTIONS_PER_VIDEO) return err(correctionLimit(context.videoId));
  return decided;
}

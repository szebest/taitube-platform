import type { ScreeningReason } from '@vp/domain';
import { ErrorCodes, type Failure } from '@vp/errors';

/** A finding whose score is not a number from 0 to 1 cannot be ranked against the others. */
export type InvalidScreeningFinding = Failure<
  typeof ErrorCodes.VALIDATION_FAILED,
  { reason: ScreeningReason; score: number }
>;

export function invalidScreeningFinding(
  reason: ScreeningReason,
  score: number
): InvalidScreeningFinding {
  return {
    code: ErrorCodes.VALIDATION_FAILED,
    message: `The ${reason} finding has a score outside 0 to 1`,
    reason,
    score,
  };
}

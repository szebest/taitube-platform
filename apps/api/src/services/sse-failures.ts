import { ErrorCodes, type Failure } from '@vp/errors';

/**
 * Why a stream could not be opened. Both are capacity, not a caller mistake, so they keep the
 * codes the hub already reported: a shutting-down or saturated pod is a 503 and a user over their
 * own stream budget is a 429.
 */
export type SseUnavailable = Failure<typeof ErrorCodes.STORAGE_UNAVAILABLE, { reason: string }>;

export type SseStreamLimitReached = Failure<
  typeof ErrorCodes.RATE_LIMITED,
  { userId: string; limit: number }
>;

export type SseRegisterFailure = SseUnavailable | SseStreamLimitReached;

export function sseUnavailable(reason: string): SseUnavailable {
  return { code: ErrorCodes.STORAGE_UNAVAILABLE, message: reason, reason };
}

export function sseStreamLimitReached(userId: string, limit: number): SseStreamLimitReached {
  return {
    code: ErrorCodes.RATE_LIMITED,
    message: `Maximum active SSE streams (${limit}) exceeded for user`,
    userId,
    limit,
  };
}

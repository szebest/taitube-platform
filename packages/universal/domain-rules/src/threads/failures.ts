import type { Failure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';

export type ThreadNotFound = Failure<typeof ErrorCodes.THREAD_NOT_FOUND, { threadId: string }>;
export type ThreadLimit = Failure<typeof ErrorCodes.THREAD_LIMIT, { limit: number }>;
export type ThreadPinLimit = Failure<typeof ErrorCodes.THREAD_PIN_LIMIT, { limit: number }>;
export type ThreadAnchorInvalid = Failure<
  typeof ErrorCodes.THREAD_ANCHOR_INVALID,
  { anchorMs: number; durationMs: number | null }
>;

export function threadNotFound(threadId: string): ThreadNotFound {
  return { code: ErrorCodes.THREAD_NOT_FOUND, message: 'Thread not found', threadId };
}

export function threadLimit(limit: number): ThreadLimit {
  return {
    code: ErrorCodes.THREAD_LIMIT,
    message: 'You already have as many open threads on this video as you can',
    limit,
  };
}

export function threadPinLimit(limit: number): ThreadPinLimit {
  return {
    code: ErrorCodes.THREAD_PIN_LIMIT,
    message: 'The video pinned as many threads as it can',
    limit,
  };
}

export function threadAnchorInvalid(
  anchorMs: number,
  durationMs: number | null
): ThreadAnchorInvalid {
  return {
    code: ErrorCodes.THREAD_ANCHOR_INVALID,
    message: 'A thread must start inside the video',
    anchorMs,
    durationMs,
  };
}

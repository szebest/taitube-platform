import { type Problem, problemFor } from '@vp/api-contracts';
import type { CommentsBanned } from '@vp/domain-rules';
import { ErrorCodes } from '@vp/errors';
import type { CreateCommentServiceFailure } from '../services/comment-create';

/**
 * The refusals of a new comment carry what the client acts on: a ban its reason and end, an account
 * the day it opens, slow mode the seconds to wait. They ride in `errors`, which is where the
 * category presenter puts a conflict's own fields, because the rest of a domain failure stays on
 * the server.
 */
export function presentBanned(failure: CommentsBanned, instance: string): Problem {
  return problemFor(failure, instance, {
    errors: [{ reason: failure.reason, expiresAt: failure.expiresAt }],
  });
}

export function presentCommentFailure(
  failure: CreateCommentServiceFailure,
  instance: string
): Problem {
  switch (failure.code) {
    case ErrorCodes.COMMENTS_BANNED:
      return presentBanned(failure, instance);
    case ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW:
      return problemFor(failure, instance, { errors: [{ opensAt: failure.opensAt }] });
    case ErrorCodes.COMMENTS_SLOW_MODE:
      return problemFor(failure, instance, {
        errors: [{ retryAfter: failure.retryAfterSeconds }],
      });
    default:
      return problemFor(failure, instance);
  }
}

/** Slow mode tells the client how long to wait in the one header HTTP has for it. */
export function commentFailureHeaders(
  failure: CreateCommentServiceFailure
): Record<string, string> {
  return failure.code === ErrorCodes.COMMENTS_SLOW_MODE
    ? { 'retry-after': String(failure.retryAfterSeconds) }
    : {};
}

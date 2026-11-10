import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';

export type CommentRefusal =
  | { kind: 'comments-disabled' }
  | { kind: 'banned'; reason: string | null; expiresAt: string | null }
  | { kind: 'subscribers-only' }
  | { kind: 'account-too-new'; opensAt: string }
  | { kind: 'slow-mode'; retryAfterMs: number };

const BanDetail = z.object({
  reason: z.string().nullish(),
  expiresAt: z.string().nullish(),
});

const OpensDetail = z.object({ opensAt: z.string() });

const SlowDetail = z.object({ retryAfter: z.number().nullish() });

const SECOND_MS = 1000;

/** What a refused new comment tells the composer to show, or `null` for a failure that is not a refusal. */
export function commentRefusal(error: unknown): CommentRefusal | null {
  if (!(error instanceof ApiError)) {
    return null;
  }
  const detail = error.problem?.errors?.[0];

  switch (error.code) {
    case ErrorCodes.COMMENTS_DISABLED:
      return { kind: 'comments-disabled' };
    case ErrorCodes.COMMENTS_SUBSCRIBERS_ONLY:
      return { kind: 'subscribers-only' };
    case ErrorCodes.COMMENTS_BANNED: {
      const ban = BanDetail.safeParse(detail);
      return {
        kind: 'banned',
        reason: (ban.success && ban.data.reason) || null,
        expiresAt: (ban.success && ban.data.expiresAt) || null,
      };
    }
    case ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW: {
      const opens = OpensDetail.safeParse(detail);
      return opens.success ? { kind: 'account-too-new', opensAt: opens.data.opensAt } : null;
    }
    case ErrorCodes.COMMENTS_SLOW_MODE: {
      const slow = SlowDetail.safeParse(detail);
      const seconds = (slow.success && slow.data.retryAfter) || 0;
      return { kind: 'slow-mode', retryAfterMs: error.retryAfterMs ?? seconds * SECOND_MS };
    }
    default:
      return null;
  }
}

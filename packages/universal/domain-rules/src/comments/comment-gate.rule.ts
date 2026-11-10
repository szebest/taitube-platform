import {
  type CommentSettings,
  type Disclosure,
  type DisclosureRule,
  type HeldReason,
} from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import { type Result, err, ok } from '@vp/result';
import { hasLinkOutsideAllowlist, matchesBlockedWord } from '@vp/validation';
import {
  type CommentsAccountTooNew,
  type CommentsBanned,
  type CommentsDisabled,
  type CommentsSubscribersOnly,
  commentsAccountTooNew,
  commentsBanned,
  commentsDisabled,
  commentsSubscribersOnly,
} from './failures';

export interface CommentGateContext {
  readonly now: Date;
  readonly videoId: string;
  readonly channelId: string;
  readonly commentsEnabled: boolean;
  /** A shadow ban takes no part: the write is accepted and stored, which keeps it silent. */
  readonly restriction: {
    readonly kind: 'ban' | 'shadow';
    readonly reason: string | null;
    readonly expiresAt: Date | null;
  } | null;
  /** The owner, a manager or a moderator of the channel. */
  readonly isTeamMember: boolean;
  readonly isSubscribed: boolean;
  readonly isTrusted: boolean;
  readonly accountCreatedAt: Date;
}

export interface CommentGateVerdict {
  readonly decision: 'publish' | 'hold';
  readonly heldReason: HeldReason | null;
  readonly disclosure: Disclosure | null;
  /** The window the caller claims after the pure checks; `null` for none or for an exempt author. */
  readonly slowModeSeconds: number | null;
}

export type CommentGateFailure =
  | CommentsBanned
  | CommentsDisabled
  | CommentsSubscribersOnly
  | CommentsAccountTooNew;

const HELD_RULE: Record<HeldReason, DisclosureRule> = {
  blocked_word: 'auto.blocked_words',
  link: 'auto.links',
  review_all: 'auto.review_all',
};

function heldReasonOf(settings: CommentSettings, text: string): HeldReason | null {
  if (matchesBlockedWord(settings.blockedWords, text)) return 'blocked_word';
  if (settings.reviewMode === 'all') return 'review_all';
  if (settings.reviewMode === 'links' && hasLinkOutsideAllowlist(text, settings.linkAllowlist)) {
    return 'link';
  }
  return null;
}

/**
 * The checks of a new comment in the order the author meets them. Slow mode is claimed against
 * Redis after these pure refusals, so a refused comment never starts the window.
 */
export function evaluateCommentGate(
  settings: CommentSettings,
  context: CommentGateContext,
  text: string
): Result<CommentGateVerdict, CommentGateFailure> {
  const { restriction, now, isTeamMember, isTrusted } = context;

  if (
    restriction?.kind === 'ban' &&
    (restriction.expiresAt === null || restriction.expiresAt > now)
  ) {
    return err(commentsBanned(restriction));
  }
  if (!(context.commentsEnabled || isTeamMember)) return err(commentsDisabled(context.videoId));
  if (settings.subscribersOnly && !(context.isSubscribed || isTeamMember)) {
    return err(commentsSubscribersOnly(context.channelId));
  }

  const exempt = isTeamMember || isTrusted;
  const opensAt = new Date(
    context.accountCreatedAt.getTime() + settings.minAccountAgeDays * MS_PER_DAY
  );
  if (!exempt && opensAt > now) return err(commentsAccountTooNew(opensAt));

  const heldReason = exempt ? null : heldReasonOf(settings, text);
  return ok({
    decision: heldReason ? 'hold' : 'publish',
    heldReason,
    disclosure: heldReason ? settings.disclosure[HELD_RULE[heldReason]] : null,
    slowModeSeconds: exempt ? null : settings.slowModeSeconds,
  });
}

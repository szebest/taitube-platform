import type { ChannelUserRestriction, RestrictionKind } from './channel-restriction';
import type { NewChannelAuditEntry } from './channel-team';
import { COMMENT_REPORT_REASONS } from './comment-report';
import type { Disclosure } from './comment-settings';

/** 103's report reasons plus the one only a moderator has. */
export const COMMENT_MODERATION_REASONS = [...COMMENT_REPORT_REASONS, 'off_topic'] as const;

export type CommentModerationReason = (typeof COMMENT_MODERATION_REASONS)[number];

export const MODERATION_STATES = ['published', 'held', 'hidden'] as const;

export type ModerationState = (typeof MODERATION_STATES)[number];

export const HELD_REASONS = ['review_all', 'link', 'blocked_word'] as const;

export type HeldReason = (typeof HELD_REASONS)[number];

/** The moderation columns a comment row carries, which only a moderator or the author may see. */
export interface CommentModerationFields {
  moderationState: ModerationState;
  moderationDisclosure: Disclosure | null;
  moderationReason: CommentModerationReason | null;
  moderationNote: string | null;
  moderatedBy: string | null;
  moderatedAt: Date | null;
  heldReason: HeldReason | null;
  looksLikeQuestion: boolean;
}

/** What the gate decided for a new comment, written with it. */
export type NewCommentModeration = Pick<
  CommentModerationFields,
  'moderationState' | 'moderationDisclosure' | 'heldReason' | 'looksLikeQuestion'
>;

export const PUBLISHED_AT_CREATION: NewCommentModeration = {
  moderationState: 'published',
  moderationDisclosure: null,
  heldReason: null,
  looksLikeQuestion: false,
};

interface Moderated {
  disclosure: Disclosure;
  reason?: CommentModerationReason;
  note?: string;
}

export type CommentModerationAction =
  | ({ action: 'hold' } & Moderated)
  | { action: 'approve' }
  | ({ action: 'hide' } & Moderated)
  | { action: 'unhide' }
  | ({ action: 'remove' } & Moderated);

/** `shadow_ban` is silent and `ban` is visible by definition, so each is its own member. */
type UserModerationAction =
  | { action: 'shadow_ban' }
  | { action: 'ban'; reason?: string; expiresAt?: Date | null }
  | { action: 'lift' };

export type ModerationAction = CommentModerationAction | UserModerationAction;

/** What a comment's moderation columns hold after an action; `removed` is no stored state. */
export interface ModerationOutcome {
  readonly state: ModerationState | 'removed';
  readonly disclosure: Disclosure | null;
  readonly reason: CommentModerationReason | null;
  readonly note: string | null;
}

const COMMENT_AUDIT_ACTIONS = {
  hold: 'comment.held',
  approve: 'comment.approved',
  hide: 'comment.hidden',
  unhide: 'comment.unhidden',
  remove: 'comment.removed',
} as const satisfies Record<CommentModerationAction['action'], string>;

/** The audit row of a comment action: the disclosure the author was given, never the reason text. */
export function commentModerationAudit(entry: {
  channelId: string;
  actorUserId: string;
  action: CommentModerationAction['action'];
  commentId: string;
  videoId: string;
  disclosure: Disclosure;
}): NewChannelAuditEntry {
  const { channelId, actorUserId, action, commentId, videoId, disclosure } = entry;
  return {
    channelId,
    actorUserId,
    action: COMMENT_AUDIT_ACTIONS[action],
    targetType: 'comment',
    targetId: commentId,
    meta: { videoId, disclosure },
  };
}

/** What a visible action tells the user it was done to, as the notification job carries it. */
export interface ModerationNotice {
  readonly userId: string;
  readonly action: 'hold' | 'hide' | 'remove' | 'ban';
  readonly channelId: string;
  readonly videoId: string | null;
  readonly commentId: string | null;
  readonly reason: string | null;
  readonly expiresAt: string | null;
  readonly excerpt: string | null;
}

/** The audit row of an action and, when the user is to be told, the notice that goes with it. */
export interface ModerationRecord {
  readonly audit: NewChannelAuditEntry;
  readonly notice?: ModerationNotice;
}

/** The audit row of a restriction: a ban carries its end, and nothing else says why. */
export function restrictionAudit(entry: {
  channelId: string;
  actorUserId: string;
  userId: string;
  restriction: Pick<ChannelUserRestriction, 'kind' | 'expiresAt'>;
}): NewChannelAuditEntry {
  const { channelId, actorUserId, userId, restriction } = entry;
  const base = { channelId, actorUserId, targetType: 'user', targetId: userId } as const;
  return restriction.kind === 'ban'
    ? {
        ...base,
        action: 'user.banned',
        meta: { expiresAt: restriction.expiresAt?.toISOString() ?? null },
      }
    : { ...base, action: 'user.shadow_banned', meta: {} };
}

export function liftAudit(entry: {
  channelId: string;
  actorUserId: string;
  userId: string;
  kind: RestrictionKind;
}): NewChannelAuditEntry {
  const { channelId, actorUserId, userId, kind } = entry;
  return {
    channelId,
    actorUserId,
    action: 'user.restriction_lifted',
    targetType: 'user',
    targetId: userId,
    meta: { kind },
  };
}

export function trustAudit(entry: {
  channelId: string;
  actorUserId: string;
  userId: string;
  trusted: boolean;
}): NewChannelAuditEntry {
  const { channelId, actorUserId, userId, trusted } = entry;
  return {
    channelId,
    actorUserId,
    action: trusted ? 'trusted.added' : 'trusted.removed',
    targetType: 'user',
    targetId: userId,
    meta: {},
  };
}

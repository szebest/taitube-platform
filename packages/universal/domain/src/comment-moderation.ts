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

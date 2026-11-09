import { ErrorCodes, type Failure } from '@vp/errors';

export type CommentNotFound = Failure<typeof ErrorCodes.COMMENT_NOT_FOUND, { commentId: string }>;

export type CommentNotPinnable = Failure<
  typeof ErrorCodes.COMMENT_NOT_PINNABLE,
  { commentId: string }
>;

export function commentNotFound(commentId: string): CommentNotFound {
  return { code: ErrorCodes.COMMENT_NOT_FOUND, message: 'Comment not found', commentId };
}

export function commentNotPinnable(commentId: string): CommentNotPinnable {
  return {
    code: ErrorCodes.COMMENT_NOT_PINNABLE,
    message: 'Only a top-level comment can be pinned',
    commentId,
  };
}

export type CommentAlreadyReported = Failure<
  typeof ErrorCodes.COMMENT_ALREADY_REPORTED,
  { commentId: string }
>;

export type ReportNotFound = Failure<typeof ErrorCodes.REPORT_NOT_FOUND, { reportId: string }>;

export type ReportAlreadyResolved = Failure<
  typeof ErrorCodes.REPORT_ALREADY_RESOLVED,
  { reportId: string }
>;

export function commentAlreadyReported(commentId: string): CommentAlreadyReported {
  return {
    code: ErrorCodes.COMMENT_ALREADY_REPORTED,
    message: 'You already reported this comment',
    commentId,
  };
}

export function reportNotFound(reportId: string): ReportNotFound {
  return { code: ErrorCodes.REPORT_NOT_FOUND, message: 'Report not found', reportId };
}

export function reportAlreadyResolved(reportId: string): ReportAlreadyResolved {
  return {
    code: ErrorCodes.REPORT_ALREADY_RESOLVED,
    message: 'Report was already resolved',
    reportId,
  };
}

export type CommentsBanned = Failure<
  typeof ErrorCodes.COMMENTS_BANNED,
  { reason: string | null; expiresAt: string | null }
>;

export type CommentsDisabled = Failure<typeof ErrorCodes.COMMENTS_DISABLED, { videoId: string }>;

export type CommentsSubscribersOnly = Failure<
  typeof ErrorCodes.COMMENTS_SUBSCRIBERS_ONLY,
  { channelId: string }
>;

export type CommentsAccountTooNew = Failure<
  typeof ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW,
  { opensAt: string }
>;

/** Why a moderation action was refused: the state forbids it, or a visible one lacks its reason. */
export type ModerationRefusal = 'state' | 'reason_required';

export type ModerationNotApplicable = Failure<
  typeof ErrorCodes.MODERATION_NOT_APPLICABLE,
  { action: string; state: string; why: ModerationRefusal }
>;

export function commentsBanned(restriction: {
  reason: string | null;
  expiresAt: Date | null;
}): CommentsBanned {
  return {
    code: ErrorCodes.COMMENTS_BANNED,
    message: 'You cannot comment on this channel',
    reason: restriction.reason,
    expiresAt: restriction.expiresAt?.toISOString() ?? null,
  };
}

export function commentsDisabled(videoId: string): CommentsDisabled {
  return { code: ErrorCodes.COMMENTS_DISABLED, message: 'Comments are turned off', videoId };
}

export function commentsSubscribersOnly(channelId: string): CommentsSubscribersOnly {
  return {
    code: ErrorCodes.COMMENTS_SUBSCRIBERS_ONLY,
    message: 'Only subscribers can comment',
    channelId,
  };
}

export function commentsAccountTooNew(opensAt: Date): CommentsAccountTooNew {
  return {
    code: ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW,
    message: 'Your account is too new to comment',
    opensAt: opensAt.toISOString(),
  };
}

export function moderationNotApplicable(
  action: string,
  state: string,
  why: ModerationRefusal
): ModerationNotApplicable {
  return {
    code: ErrorCodes.MODERATION_NOT_APPLICABLE,
    message: 'That action does not apply to this comment',
    action,
    state,
    why,
  };
}

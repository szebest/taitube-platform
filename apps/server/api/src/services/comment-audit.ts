import { type Comment, type NewChannelAuditEntry, commentModerationAudit } from '@vp/domain';
import type { UserContext } from '@vp/permissions';

/** Deleting a comment is silent in the log, and the author's own delete is not moderation at all. */
export function deletionAudit(
  channelId: string | undefined,
  actor: UserContext,
  comment: Comment
): { audit: NewChannelAuditEntry } | undefined {
  if (!channelId || actor.id === comment.authorId) return undefined;

  return {
    audit: commentModerationAudit({
      channelId,
      actorUserId: actor.id,
      action: 'remove',
      commentId: comment.id,
      videoId: comment.videoId,
      disclosure: 'silent',
    }),
  };
}

export function pinAudit(
  channelId: string | undefined,
  actor: UserContext,
  comment: Comment,
  pinned: boolean
): NewChannelAuditEntry | undefined {
  if (!channelId) return undefined;

  return {
    channelId,
    actorUserId: actor.id,
    action: 'comment.pinned',
    targetType: 'comment',
    targetId: comment.id,
    meta: { videoId: comment.videoId, pinned },
  };
}

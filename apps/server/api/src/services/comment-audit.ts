import {
  type Comment,
  type NewChannelAuditEntry,
  commentModerationAudit,
  commentVideoId,
} from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { auditActor } from './audit-actor';

/** Deleting a comment is silent in the log, and the author's own delete is not moderation at all. */
export function deletionAudit(
  actor: UserContext,
  comment: Comment
): { audit: NewChannelAuditEntry } | undefined {
  if (actor.id === comment.authorId) return undefined;

  return {
    audit: commentModerationAudit({
      channelId: comment.channelId,
      ...auditActor(actor),
      action: 'remove',
      commentId: comment.id,
      videoId: commentVideoId(comment.target),
      disclosure: 'silent',
    }),
  };
}

export function pinAudit(
  actor: UserContext,
  comment: Comment,
  pinned: boolean
): NewChannelAuditEntry {
  return {
    channelId: comment.channelId,
    ...auditActor(actor),
    action: 'comment.pinned',
    targetType: 'comment',
    targetId: comment.id,
    meta: { videoId: commentVideoId(comment.target), pinned },
  };
}

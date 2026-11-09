import type { CommentView, CreatorInboxCommentView } from '@vp/api-contracts';
import type { CommentThread, CreatorInboxComment } from '@vp/domain';

/** `isCreator` is a badge on the wire, never a permission; moderation asks `@vp/permissions`. */
export function toCommentView(thread: CommentThread, videoOwnerId: string): CommentView {
  const { id, videoId, parentId, content, isPinned, isEdited, likeCount, replyCount } = thread;
  const { author, heartedAt, createdAt, updatedAt } = thread;
  return {
    id,
    videoId,
    parentId,
    content,
    isPinned,
    isEdited,
    likeCount,
    replyCount,
    heartedByCreator: heartedAt !== null,
    author: { ...author, isCreator: author.userId === videoOwnerId },
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export function toCreatorInboxCommentView(
  { video, ...thread }: CreatorInboxComment,
  videoOwnerId: string
): CreatorInboxCommentView {
  return { ...toCommentView(thread, videoOwnerId), video };
}

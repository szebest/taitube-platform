import type { CommentView, CreatorInboxCommentView } from '@vp/api-contracts';
import type { CommentThread, CreatorInboxComment } from '@vp/domain';

/** `isCreator` is a badge on the wire, never a permission; moderation asks `@vp/permissions`. */
export function toCommentView(thread: CommentThread, videoOwnerId: string): CommentView {
  const { authorId: _authorId, author, heartedAt, createdAt, updatedAt, ...comment } = thread;
  return {
    ...comment,
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

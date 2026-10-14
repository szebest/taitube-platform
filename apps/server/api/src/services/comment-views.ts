import type { CommentView } from '@vp/api-contracts';
import type { CommentThread } from '@vp/domain';

/** `isCreator` is a badge on the wire, never a permission; moderation asks `@vp/permissions`. */
export function toCommentView(thread: CommentThread, videoOwnerId: string): CommentView {
  const { authorId: _authorId, author, createdAt, updatedAt, ...comment } = thread;
  return {
    ...comment,
    author: { ...author, isCreator: author.userId === videoOwnerId },
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

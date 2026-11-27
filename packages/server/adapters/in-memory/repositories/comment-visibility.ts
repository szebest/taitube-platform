import type { Comment } from '@vp/domain';

export interface StoredComment extends Comment {
  deletedAt: Date | null;
}

/** The in-memory form of `notDeletedScope`: every comment still standing. */
export function standing(comments: Iterable<StoredComment>): StoredComment[] {
  return Array.from(comments).filter((comment) => comment.deletedAt === null);
}

export function repliesOf(comments: Iterable<StoredComment>, rootId: string): StoredComment[] {
  return standing(comments).filter((comment) => comment.parentId === rootId);
}

import type { CreatorInboxFilter } from '@vp/domain';
import { assertNever } from '@vp/result';
import { compareKeys } from './comment-order';

interface InboxRow {
  id: string;
  parentId: string | null;
  authorId: string;
  createdAt: Date;
}

/** The in-memory form of `creatorInboxFilterScope`; `live` is every comment still standing. */
export function matchesInbox(
  comment: InboxRow,
  filter: CreatorInboxFilter,
  ownerId: string,
  live: readonly InboxRow[],
  reports: { hasOpenReport(commentId: string): boolean }
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'unanswered': {
      const threadRoot = comment.parentId ?? comment.id;
      return !live.some(
        (other) =>
          other.parentId === threadRoot &&
          other.authorId === ownerId &&
          compareKeys(
            [other.createdAt.getTime(), other.id],
            [comment.createdAt.getTime(), comment.id]
          ) > 0
      );
    }
    case 'reported':
      return reports.hasOpenReport(comment.id);
    default:
      return assertNever(filter, 'CreatorInboxFilter');
  }
}

import type { ListCreatorInboxOptions } from '@vp/core/repositories';
import type { CreatorInboxFilter, ModerationState } from '@vp/domain';
import { assertNever } from '@vp/result';
import { compareKeys, newestAfter, rowKey } from './comment-order';
import type { StoredComment } from './comment-visibility';

interface InboxRow {
  id: string;
  parentId: string | null;
  authorId: string;
  createdAt: Date;
  moderationState: ModerationState;
  looksLikeQuestion: boolean;
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
    case 'held':
    case 'hidden':
      return comment.moderationState === filter;
    case 'questions':
      return comment.looksLikeQuestion;
    default:
      return assertNever(filter, 'CreatorInboxFilter');
  }
}

/** One inbox page, up to one row past the limit: comments on the owner's videos, newest first. */
export function inboxPage(
  live: readonly StoredComment[],
  ownerVideos: ReadonlyMap<string, unknown>,
  ownerId: string,
  { filter, cursor, limit }: ListCreatorInboxOptions,
  reports: { hasOpenReport(commentId: string): boolean }
): StoredComment[] {
  const mine = live
    .filter((comment) => ownerVideos.has(comment.videoId) && comment.authorId !== ownerId)
    .filter((comment) => matchesInbox(comment, filter, ownerId, live, reports))
    .sort((a, b) => compareKeys(rowKey(b), rowKey(a)));
  return newestAfter(mine, cursor).slice(0, limit + 1);
}

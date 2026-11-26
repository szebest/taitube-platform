import { assertNever } from '@kit/result';
import type { ListCreatorInboxOptions } from '@vp/core/repositories';
import type {
  CommentThread,
  CreatorInboxComment,
  CreatorInboxFilter,
  ModerationState,
} from '@vp/domain';
import { compareKeys, newestAfter, rowKey } from './comment-order';
import type { StoredComment } from './comment-visibility';
import type { InMemoryChannelUserRestrictionRepository } from './in-memory-channel-user-restriction-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';

interface InboxRow {
  id: string;
  videoId: string;
  parentId: string | null;
  authorId: string;
  createdAt: Date;
  moderationState: ModerationState;
  looksLikeQuestion: boolean;
}

interface InboxLookups {
  hasOpenReport(commentId: string): boolean;
  /** Whether the author is restricted on the channel of the video the comment is under. */
  isRestricted(comment: InboxRow): boolean;
}

/** @internal The in-memory form of `creatorInboxFilterScope`; `live` is every comment still standing. */
export function matchesInbox(
  comment: InboxRow,
  filter: CreatorInboxFilter,
  ownerId: string,
  live: readonly InboxRow[],
  lookups: InboxLookups
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
      return lookups.hasOpenReport(comment.id);
    case 'held':
    case 'hidden':
      return comment.moderationState === filter;
    case 'questions':
      return comment.looksLikeQuestion;
    case 'restricted':
      return lookups.isRestricted(comment);
    default:
      return assertNever(filter, 'CreatorInboxFilter');
  }
}

function inboxPage(
  live: readonly StoredComment[],
  ownerVideos: ReadonlyMap<string, unknown>,
  ownerId: string,
  { filter, authorId, cursor, limit }: ListCreatorInboxOptions,
  lookups: InboxLookups
): StoredComment[] {
  const mine = live
    .filter((comment) => ownerVideos.has(comment.videoId) && comment.authorId !== ownerId)
    .filter((comment) => authorId === undefined || comment.authorId === authorId)
    .filter((comment) => matchesInbox(comment, filter, ownerId, live, lookups))
    .sort((a, b) => compareKeys(rowKey(b), rowKey(a)));
  return newestAfter(mine, cursor).slice(0, limit + 1);
}

interface CreatorInboxDeps {
  videosRepo: Pick<InMemoryVideoRepository, 'getAllVideos'>;
  reportsRepo: { hasOpenReport(commentId: string): boolean };
  restrictionsRepo: Pick<InMemoryChannelUserRestrictionRepository, 'restrictedUserIds'>;
}

/** One inbox page, up to one row past the limit: comments on the channel's videos, newest first. */
export async function creatorInbox(
  { videosRepo, reportsRepo, restrictionsRepo }: CreatorInboxDeps,
  live: readonly StoredComment[],
  ownerId: string,
  options: ListCreatorInboxOptions,
  toThreads: (rows: readonly StoredComment[]) => Promise<CommentThread[]>
): Promise<CreatorInboxComment[]> {
  const videos = new Map(
    videosRepo
      .getAllVideos()
      .filter((video) => video.channelId === options.channelId && !video.deletedAt)
      .map((video) => [video.id, video])
  );
  const lookups = {
    hasOpenReport: (commentId: string) => reportsRepo.hasOpenReport(commentId),
    isRestricted: ({ videoId, authorId }: InboxRow) => {
      const channelId = videos.get(videoId)?.channelId;
      return channelId !== undefined && restrictionsRepo.restrictedUserIds(channelId).has(authorId);
    },
  };
  const rows = await toThreads(inboxPage(live, videos, ownerId, options, lookups));
  return rows.map((row) => ({
    ...row,
    video: { id: row.videoId, title: videos.get(row.videoId)?.title ?? '' },
  }));
}

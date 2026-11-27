import { assertNever } from '@kit/result';
import type { ListCreatorInboxOptions } from '@vp/core/repositories';
import {
  type CommentTarget,
  type CommentThread,
  type CreatorInboxComment,
  type CreatorInboxFilter,
  type ModerationState,
  POST_TARGET_TITLE_LENGTH,
  type PostPayload,
} from '@vp/domain';
import { compareKeys, newestAfter, rowKey } from './comment-order';
import type { StoredComment } from './comment-visibility';
import type { InMemoryChannelPostRepository } from './in-memory-channel-post-repository';
import type { InMemoryChannelUserRestrictionRepository } from './in-memory-channel-user-restriction-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';

interface InboxRow {
  id: string;
  channelId: string;
  parentId: string | null;
  authorId: string;
  createdAt: Date;
  moderationState: ModerationState;
  looksLikeQuestion: boolean;
}

interface InboxLookups {
  hasOpenReport(commentId: string): boolean;
  /** Whether the author is restricted on the channel the comment is moderated by. */
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

function textOf(payload: PostPayload): string {
  switch (payload.kind) {
    case 'text':
      return payload.text;
    case 'images':
      return payload.caption ?? '';
    case 'poll':
    case 'quiz':
      return payload.question;
    case 'video_share':
    case 'playlist_share':
      return payload.comment ?? '';
    default:
      return assertNever(payload, 'PostPayload');
  }
}

function inboxPage(
  live: readonly StoredComment[],
  ownerId: string,
  { channelId, filter, authorId, cursor, limit }: ListCreatorInboxOptions,
  lookups: InboxLookups & { isListed(target: CommentTarget): boolean }
): StoredComment[] {
  const mine = live
    .filter((comment) => comment.channelId === channelId && comment.authorId !== ownerId)
    .filter((comment) => lookups.isListed(comment.target))
    .filter((comment) => authorId === undefined || comment.authorId === authorId)
    .filter((comment) => matchesInbox(comment, filter, ownerId, live, lookups))
    .sort((a, b) => compareKeys(rowKey(b), rowKey(a)));
  return newestAfter(mine, cursor).slice(0, limit + 1);
}

interface CreatorInboxDeps {
  videosRepo: Pick<InMemoryVideoRepository, 'getAllVideos'>;
  postsRepo: Pick<InMemoryChannelPostRepository, 'posts'>;
  reportsRepo: { hasOpenReport(commentId: string): boolean };
  restrictionsRepo: Pick<InMemoryChannelUserRestrictionRepository, 'restrictedUserIds'>;
}

/** One inbox page, up to one row past the limit: comments on the channel's videos and posts, newest first. */
export async function creatorInbox(
  { videosRepo, postsRepo, reportsRepo, restrictionsRepo }: CreatorInboxDeps,
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
    isRestricted: ({ channelId, authorId }: InboxRow) =>
      restrictionsRepo.restrictedUserIds(channelId).has(authorId),
    isListed: ({ type, id }: CommentTarget) =>
      type === 'video' ? videos.has(id) : postsRepo.posts.has(id),
  };
  const rows = await toThreads(inboxPage(live, ownerId, options, lookups));
  return rows.map((row) => {
    const { type, id } = row.target;
    switch (type) {
      case 'video': {
        const title = videos.get(id)?.title ?? '';
        return { ...row, video: { id, title }, targetSummary: { type, id, title } };
      }
      case 'post': {
        const post = postsRepo.posts.get(id);
        const title = (post ? textOf(post.payload) : '').slice(0, POST_TARGET_TITLE_LENGTH);
        return { ...row, video: null, targetSummary: { type, id, title } };
      }
      default:
        return assertNever(type, 'CommentTarget');
    }
  });
}

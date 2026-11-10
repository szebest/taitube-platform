import * as schema from '@vp/db';
import type { CreatorInboxComment, CreatorInboxFilter } from '@vp/domain';
import { assertNever } from '@vp/result';
import { type SQL, sql } from 'drizzle-orm';
import { moderatedThreadColumns, toCommentThread } from './comment-thread-query';

const {
  videoComments: c,
  videos: v,
  commentReports: r,
  channelUserRestrictions: rs,
  channels: rc,
} = schema;

/** The thread columns plus the title of the video the comment sits under. */
export const creatorInboxColumns = { ...moderatedThreadColumns, videoTitle: v.title };

type InboxRow = Parameters<typeof toCommentThread>[0] & { videoTitle: string };

export function toCreatorInboxComment({ videoTitle, ...row }: InboxRow): CreatorInboxComment {
  const thread = toCommentThread(row);
  return { ...thread, video: { id: thread.videoId, title: videoTitle } };
}

/**
 * A comment is answered by a later reply from the owner anywhere in its own thread, and
 * restricted when its author has a shadow ban or a ban on the owner's channel that has not ended.
 */
export function creatorInboxFilterScope(
  filter: CreatorInboxFilter,
  ownerId: string
): SQL | undefined {
  switch (filter) {
    case 'all':
      return undefined;
    case 'unanswered':
      return sql`not exists (
        select 1 from ${c} as answer
        where answer.video_id = ${c.videoId}
          and answer.parent_id = coalesce(${c.parentId}, ${c.id})
          and answer.author_id = ${ownerId}
          and (answer.created_at, answer.id) > (${c.createdAt}, ${c.id})
          and answer.deleted_at is null
      )`;
    case 'reported':
      return sql`exists (
        select 1 from ${r} where ${r.commentId} = ${c.id} and ${r.resolvedAt} is null
      )`;
    case 'held':
    case 'hidden':
      return sql`${c.moderationState} = ${filter}`;
    case 'questions':
      return sql`${c.looksLikeQuestion}`;
    case 'restricted':
      return sql`exists (
        select 1 from ${rs} inner join ${rc} on ${rc.id} = ${rs.channelId}
        where ${rc.userId} = ${ownerId} and ${rs.userId} = ${c.authorId}
          and (${rs.expiresAt} is null or ${rs.expiresAt} > now())
      )`;
    default:
      return assertNever(filter, 'CreatorInboxFilter');
  }
}

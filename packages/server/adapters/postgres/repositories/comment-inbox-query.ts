import * as schema from '@vp/db';
import type { CreatorInboxComment, CreatorInboxFilter } from '@vp/domain';
import { assertNever } from '@vp/result';
import { type SQL, sql } from 'drizzle-orm';
import { commentThreadColumns, toCommentThread } from './comment-thread-query';

const { videoComments: c, videos: v, commentReports: r } = schema;

/** The thread columns plus the title of the video the comment sits under. */
export const creatorInboxColumns = { ...commentThreadColumns, videoTitle: v.title };

type InboxRow = Parameters<typeof toCommentThread>[0] & { videoTitle: string };

export function toCreatorInboxComment({ videoTitle, ...row }: InboxRow): CreatorInboxComment {
  const thread = toCommentThread(row);
  return { ...thread, video: { id: thread.videoId, title: videoTitle } };
}

/** A comment is answered by a later reply from the owner anywhere in its own thread. */
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
    default:
      return assertNever(filter, 'CreatorInboxFilter');
  }
}

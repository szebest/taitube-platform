import { assertNever } from '@kit/result';
import * as schema from '@vp/db';
import {
  type CreatorInboxComment,
  type CreatorInboxFilter,
  POST_TARGET_TITLE_LENGTH,
} from '@vp/domain';
import { type SQL, sql } from 'drizzle-orm';
import { moderatedThreadColumns, toCommentThread } from './comment-thread-query';

const {
  comments: c,
  videos: v,
  channelPosts: p,
  commentReports: r,
  channelUserRestrictions: rs,
} = schema;

/**
 * What the row names its target by: the video title, or the start of the post's text. Selected
 * over the comments left-joined to the video and the post the target may be.
 */
const targetTitle = sql<string>`coalesce(${v.title}, left(coalesce(
  ${p.payload} ->> 'text', ${p.payload} ->> 'question', ${p.payload} ->> 'caption', ${p.payload} ->> 'comment', ''
), ${POST_TARGET_TITLE_LENGTH}))`;

/** The thread columns plus the title of the target the comment sits under. */
export const creatorInboxColumns = { ...moderatedThreadColumns, targetTitle };

type InboxRow = Parameters<typeof toCommentThread>[0] & { targetTitle: string };

export function toCreatorInboxComment({
  targetTitle: title,
  ...row
}: InboxRow): CreatorInboxComment {
  const thread = toCommentThread(row);
  const { type, id } = thread.target;
  return {
    ...thread,
    video: type === 'video' ? { id, title } : null,
    targetSummary: { type, id, title },
  };
}

/**
 * A comment is answered by a later reply from the owner anywhere in its own thread, and
 * restricted when its author has a shadow ban or a ban on the comment's channel that has not ended.
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
        where answer.target_type = ${c.targetType} and answer.target_id = ${c.targetId}
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
        select 1 from ${rs}
        where ${rs.channelId} = ${c.channelId} and ${rs.userId} = ${c.authorId}
          and (${rs.expiresAt} is null or ${rs.expiresAt} > now())
      )`;
    default:
      return assertNever(filter, 'CreatorInboxFilter');
  }
}

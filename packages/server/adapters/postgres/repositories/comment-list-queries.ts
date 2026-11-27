import type { ListAuthoredCommentsOptions, ListCreatorInboxOptions } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { AuthoredComment } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { and, eq, ne, or } from 'drizzle-orm';
import { drizzleWhere, notDeletedScope, watchableVideoScope } from '../scopes/index';
import { creatorInboxColumns, creatorInboxFilterScope } from './comment-inbox-query';
import { commentInboxCursorScope, commentInboxOrderBy } from './comment-thread-query';
import type { PostgresDatabase } from './types';

const { comments: c, channels: ch, videos: v, channelPosts: p } = schema;

/** Live comments on the channel's videos and posts that its owner did not write, one row more than a page. */
export function creatorInboxQuery(
  db: PostgresDatabase,
  ownerId: string,
  { channelId, filter, authorId, cursor, limit }: ListCreatorInboxOptions
) {
  return db
    .select(creatorInboxColumns)
    .from(c)
    .leftJoin(v, and(eq(c.targetType, 'video'), eq(v.id, c.targetId)))
    .leftJoin(p, and(eq(c.targetType, 'post'), eq(p.id, c.targetId)))
    .leftJoin(ch, eq(ch.id, c.authorChannelId))
    .where(
      drizzleWhere(
        eq(c.channelId, channelId),
        ne(c.authorId, ownerId),
        notDeletedScope(c),
        or(ne(c.targetType, 'video'), notDeletedScope(v)),
        creatorInboxFilterScope(filter, ownerId),
        authorId === undefined ? undefined : eq(c.authorId, authorId),
        commentInboxCursorScope(cursor)
      )
    )
    .orderBy(...commentInboxOrderBy())
    .limit(limit + 1);
}

/** The viewer's own live comments under videos they may watch, one row more than a page. */
export function authoredCommentsQuery(
  db: PostgresDatabase,
  viewer: UserContext,
  { cursor, limit }: ListAuthoredCommentsOptions
) {
  return db
    .select({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      parentId: c.parentId,
      likeCount: c.likeCount,
      videoId: v.id,
      videoTitle: v.title,
    })
    .from(c)
    .innerJoin(v, and(eq(c.targetType, 'video'), eq(v.id, c.targetId)))
    .where(
      drizzleWhere(
        eq(c.authorId, viewer.id),
        notDeletedScope(c),
        watchableVideoScope(viewer),
        commentInboxCursorScope(cursor)
      )
    )
    .orderBy(...commentInboxOrderBy())
    .limit(limit + 1);
}

export function toAuthoredComment({
  videoId,
  videoTitle,
  ...comment
}: Awaited<ReturnType<typeof authoredCommentsQuery>>[number]): AuthoredComment {
  return { ...comment, video: { id: videoId, title: videoTitle } };
}

import type { ListAuthoredCommentsOptions, ListCreatorInboxOptions } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { AuthoredComment } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { eq, ne } from 'drizzle-orm';
import { drizzleWhere, notDeletedScope, watchableVideoScope } from '../scopes/index';
import { creatorInboxColumns, creatorInboxFilterScope } from './comment-inbox-query';
import { commentInboxCursorScope, commentInboxOrderBy } from './comment-thread-query';
import type { PostgresDatabase } from './types';

const { videoComments: c, channels: ch, videos: v } = schema;

/** Live comments on `ownerId`'s videos that the owner did not write, one row more than a page. */
export function creatorInboxQuery(
  db: PostgresDatabase,
  ownerId: string,
  { filter, cursor, limit }: ListCreatorInboxOptions
) {
  return db
    .select(creatorInboxColumns)
    .from(c)
    .innerJoin(v, eq(v.id, c.videoId))
    .leftJoin(ch, eq(ch.userId, c.authorId))
    .where(
      drizzleWhere(
        eq(v.ownerId, ownerId),
        ne(c.authorId, ownerId),
        notDeletedScope(c),
        notDeletedScope(v),
        creatorInboxFilterScope(filter, ownerId),
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
    .innerJoin(v, eq(v.id, c.videoId))
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

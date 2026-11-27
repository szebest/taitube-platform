import { MS_PER_DAY } from '@kit/primitives';
import type { ExportScope } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { CommentExportRow, PostExportRow, VideoExportRow } from '@vp/domain';
import { and, asc, eq, gte, isNull, lt } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { keysetPast, msTimestamp } from '../scopes/index';
import type { PostgresDatabase } from './types';

const { comments: c, videos: v, channels: ch, categories: cat, channelPosts: p } = schema;

export interface CreatedKey {
  createdAt: Date;
  id: string;
}

/** The days of the range as a half-open span of instants, so `to` keeps its whole last day. */
function madeWithin(column: AnyPgColumn, { from, to }: ExportScope['range']) {
  return and(
    from ? gte(column, new Date(from)) : undefined,
    to ? lt(column, new Date(Date.parse(to) + MS_PER_DAY)) : undefined
  );
}

const keyOf = (after: CreatedKey | null) => after && { sort: after.createdAt, tie: after.id };

/** Removed comments are gone from the export; held and hidden ones stay, with how they were disclosed. */
export async function commentRows(
  db: PostgresDatabase,
  scope: ExportScope,
  after: CreatedKey | null,
  limit: number
): Promise<CommentExportRow[]> {
  const rows = await db
    .select({
      commentId: c.id,
      videoId: v.id,
      videoTitle: v.title,
      parentId: c.parentId,
      authorHandle: ch.handle,
      authorDisplayName: ch.displayName,
      text: c.content,
      createdAt: c.createdAt,
      likes: c.likeCount,
      heartedAt: c.heartedAt,
      pinned: c.isPinned,
      moderationState: c.moderationState,
      disclosure: c.moderationDisclosure,
    })
    .from(c)
    .innerJoin(v, and(eq(c.targetType, 'video'), eq(v.id, c.targetId)))
    .leftJoin(ch, eq(ch.id, c.authorChannelId))
    .where(
      and(
        eq(v.channelId, scope.channelId),
        isNull(v.deletedAt),
        isNull(c.deletedAt),
        madeWithin(c.createdAt, scope.range),
        keysetPast(msTimestamp(c.createdAt), c.id, keyOf(after), 'asc')
      )
    )
    .orderBy(asc(msTimestamp(c.createdAt)), asc(c.id))
    .limit(limit);

  return rows.map(({ heartedAt, createdAt, ...row }) => ({
    ...row,
    createdAt: createdAt.toISOString(),
    hearted: heartedAt !== null,
  }));
}

export async function videoRows(
  db: PostgresDatabase,
  scope: ExportScope,
  after: CreatedKey | null,
  limit: number
): Promise<VideoExportRow[]> {
  const rows = await db
    .select({
      videoId: v.id,
      title: v.title,
      description: v.description,
      tags: v.tags,
      category: cat.slug,
      visibility: v.visibility,
      status: v.status,
      durationMs: v.durationMs,
      views: v.viewsCount,
      likes: v.likesCount,
      dislikes: v.dislikesCount,
      comments: v.commentsCount,
      createdAt: v.createdAt,
      readyAt: v.readyAt,
    })
    .from(v)
    .leftJoin(cat, eq(cat.id, v.categoryId))
    .where(
      and(
        eq(v.channelId, scope.channelId),
        isNull(v.deletedAt),
        madeWithin(v.createdAt, scope.range),
        keysetPast(msTimestamp(v.createdAt), v.id, keyOf(after), 'asc')
      )
    )
    .orderBy(asc(msTimestamp(v.createdAt)), asc(v.id))
    .limit(limit);

  return rows.map(({ createdAt, readyAt, ...row }) => ({
    ...row,
    createdAt: createdAt.toISOString(),
    readyAt: readyAt?.toISOString() ?? null,
  }));
}

export async function postRows(
  db: PostgresDatabase,
  scope: ExportScope,
  after: CreatedKey | null,
  limit: number
): Promise<PostExportRow[]> {
  const rows = await db
    .select({
      postId: p.id,
      kind: p.kind,
      status: p.status,
      payload: p.payload,
      commentsEnabled: p.commentsEnabled,
      likeCount: p.likeCount,
      commentsCount: p.commentsCount,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
      editedAt: p.editedAt,
    })
    .from(p)
    .where(
      and(
        eq(p.channelId, scope.channelId),
        madeWithin(p.createdAt, scope.range),
        keysetPast(msTimestamp(p.createdAt), p.id, keyOf(after), 'asc')
      )
    )
    .orderBy(asc(msTimestamp(p.createdAt)), asc(p.id))
    .limit(limit);

  return rows.map(({ payload, publishedAt, createdAt, editedAt, ...row }) => ({
    ...row,
    payload: JSON.stringify(payload),
    publishedAt: publishedAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    editedAt: editedAt?.toISOString() ?? null,
  }));
}

import { MS_PER_SECOND } from '@kit/primitives';
import { assertNever } from '@kit/result';
import type { PlaylistItemsRequest, PoolRequest, SmartRequest } from '@vp/core/repositories';
import {
  channelPosts as p,
  liveStreams as ls,
  playlistItems as pi,
  playlists as pl,
  videos as v,
} from '@vp/db';
import { type SQL, and, arrayOverlaps, asc, desc, eq, gte, lte, or, sql } from 'drizzle-orm';
import { drizzleWhere } from '../scopes/index';
import { publicFeedScope } from './public-feed-query';
import { rulesSql, smartSortKey } from './smart-playlist-query';
import type { PostgresDatabase } from './types';

type Ordering = [SQL, SQL];

function keyOf(key: string): SQL<string> {
  return sql<string>`${key}::text`;
}

function ordering(sort: PoolRequest['sort'], popular: SQL, newest: SQL, tie: SQL): Ordering {
  switch (sort) {
    case 'newest':
      return [desc(newest), desc(tie)];
    case 'oldest':
      return [asc(newest), asc(tie)];
    case 'popular':
    case 'most_liked':
      return [desc(popular), desc(tie)];
    default:
      return assertNever(sort, 'PoolRequestSort');
  }
}

export function videoPool(db: PostgresDatabase, channelId: string, format: 'standard' | 'short') {
  return (request: PoolRequest) =>
    db
      .select({ key: keyOf(request.key), id: v.id })
      .from(v)
      .where(
        drizzleWhere(
          publicFeedScope({ channelId, format }),
          request.tags.length > 0 ? arrayOverlaps(v.tags, [...request.tags]) : undefined,
          request.since ? gte(v.createdAt, request.since) : undefined,
          request.until ? lte(v.createdAt, request.until) : undefined,
          request.minDurationSec === null
            ? undefined
            : gte(v.durationMs, request.minDurationSec * MS_PER_SECOND),
          request.maxDurationSec === null
            ? undefined
            : lte(v.durationMs, request.maxDurationSec * MS_PER_SECOND)
        )
      )
      .orderBy(
        ...ordering(
          request.sort,
          request.sort === 'most_liked' ? sql`${v.likesCount}` : sql`${v.viewsCount}`,
          sql`${v.createdAt}`,
          sql`${v.id}`
        )
      )
      .limit(request.limit);
}

export function postPool(db: PostgresDatabase, channelId: string) {
  return (request: PoolRequest) =>
    db
      .select({ key: keyOf(request.key), id: p.id })
      .from(p)
      .where(
        drizzleWhere(
          eq(p.channelId, channelId),
          eq(p.status, 'published'),
          request.since ? gte(p.publishedAt, request.since) : undefined,
          request.until ? lte(p.publishedAt, request.until) : undefined
        )
      )
      .orderBy(...ordering(request.sort, sql`${p.likeCount}`, sql`${p.publishedAt}`, sql`${p.id}`))
      .limit(request.limit);
}

export function livePool(db: PostgresDatabase, channelId: string) {
  const startedOrCreated = sql`coalesce(${ls.startedAt}, ${ls.createdAt})`;
  return (request: PoolRequest) =>
    db
      .select({ key: keyOf(request.key), id: ls.id })
      .from(ls)
      .where(
        drizzleWhere(
          eq(ls.channelId, channelId),
          eq(ls.visibility, 'public'),
          or(
            eq(ls.status, 'LIVE'),
            and(eq(ls.status, 'ENDED'), eq(ls.archiveVisibility, 'public'))
          ),
          request.since ? gte(startedOrCreated, request.since) : undefined,
          request.until ? lte(startedOrCreated, request.until) : undefined
        )
      )
      .orderBy(
        ...ordering(request.sort, sql`${ls.currentViewers}`, startedOrCreated, sql`${ls.id}`)
      )
      .limit(request.limit);
}

export function playlistPool(db: PostgresDatabase, ownerUserId: string) {
  return (request: PoolRequest) =>
    db
      .select({ key: keyOf(request.key), id: pl.id })
      .from(pl)
      .where(
        drizzleWhere(
          eq(pl.ownerId, ownerUserId),
          eq(pl.visibility, 'public'),
          eq(pl.isSystem, false),
          request.since ? gte(pl.updatedAt, request.since) : undefined,
          request.until ? lte(pl.updatedAt, request.until) : undefined
        )
      )
      .orderBy(...ordering(request.sort, sql`${pl.updatedAt}`, sql`${pl.updatedAt}`, sql`${pl.id}`))
      .limit(request.limit);
}

export function playlistItemsQuery(db: PostgresDatabase, request: PlaylistItemsRequest) {
  return db
    .select({ key: keyOf(request.key), id: v.id })
    .from(pi)
    .innerJoin(pl, eq(pl.id, pi.playlistId))
    .innerJoin(v, eq(v.id, pi.videoId))
    .where(
      drizzleWhere(
        eq(pi.playlistId, request.playlistId),
        eq(pl.visibility, 'public'),
        publicFeedScope()
      )
    )
    .orderBy(asc(pi.position))
    .limit(request.limit);
}

export function smartQuery(db: PostgresDatabase, channelId: string, now: Date) {
  return (request: SmartRequest) => {
    const { key, order } = smartSortKey(request.rules.sort);
    const direction = order === 'asc' ? asc : desc;
    return db
      .select({ key: keyOf(request.key), id: v.id })
      .from(v)
      .where(drizzleWhere(publicFeedScope({ channelId }), rulesSql(request.rules, null, now)))
      .orderBy(direction(key), direction(v.id))
      .limit(Math.min(request.rules.limit, request.limit));
  };
}

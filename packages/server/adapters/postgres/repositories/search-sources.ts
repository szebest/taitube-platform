import type { SearchHit, SearchQuery } from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  PUBLIC_FEED_STATUS,
  SEARCH_RANKING,
  type SearchResultKind,
  searchHandleOf,
} from '@vp/domain';
import { SECONDS_PER_DAY } from '@vp/domain/time';
import { type SQL, count, desc, eq, getTableColumns, or, sql } from 'drizzle-orm';
import { type AnyPgColumn, type PgTable, QueryBuilder } from 'drizzle-orm/pg-core';
import {
  drizzleWhere,
  notDeletedScope,
  playlistReadScope,
  publicVisibilityScope,
  videoReadScope,
  watchableVideoScope,
} from '../scopes/index';
import { channelCardColumns, toChannelCard } from './channel-card-query';
import { toPlaylist } from './playlist-query';
import {
  type SortKeys,
  type TextMatch,
  afterCursor,
  epochOf,
  instantOf,
  sortKey,
  textMatch,
} from './search-query';
import { constant } from './sql-constant';
import type { PostgresDatabase } from './types';

const { videos: v, channels: ch, playlists: p, playlistItems: pi, searchVectors } = schema;
const R = SEARCH_RANKING;

interface SourceSpec<M extends TextMatch> {
  kind: SearchResultKind;
  table: PgTable;
  id: AnyPgColumn;
  match(query: SearchQuery): M;
  scope(query: SearchQuery, match: M): SQL | undefined;
  keys(query: SearchQuery, match: M): SortKeys;
  rows(
    db: PostgresDatabase,
    where: SQL | undefined,
    key: SQL<number>,
    limit: number
  ): Promise<SearchHit[]>;
}

export interface SearchSource {
  hits(db: PostgresDatabase): Promise<SearchHit[]>;
  total(db: PostgresDatabase): Promise<number>;
}

function sourceOf<M extends TextMatch>(spec: SourceSpec<M>) {
  return (query: SearchQuery): SearchSource => {
    const match = spec.match(query);
    const where = spec.scope(query, match);
    const key = sortKey(query.sort, spec.keys(query, match));
    return {
      hits: (db) =>
        spec.rows(
          db,
          drizzleWhere(where, afterCursor(spec.kind, key, spec.id, query.cursor)),
          key,
          query.limit + 1
        ),
      total: async (db) => {
        const [row] = await db.select({ n: count() }).from(spec.table).where(where);
        return row?.n ?? 0;
      },
    };
  };
}

export const videoSource = sourceOf({
  kind: 'video',
  table: v,
  id: v.id,
  match: (query) => textMatch(query.mode, query.text, searchVectors.videos, [v.title]),
  scope: (query, match) =>
    drizzleWhere(
      videoReadScope(null),
      notDeletedScope(v),
      publicVisibilityScope(v),
      eq(v.status, PUBLIC_FEED_STATUS),
      query.categoryId ? eq(v.categoryId, query.categoryId) : undefined,
      match.where
    ),
  keys: (query, match) => {
    const ageDays = sql`greatest(0, extract(epoch from (${instantOf(query.instant)} - ${v.createdAt})) / ${constant(SECONDS_PER_DAY)})`;
    return {
      relevance: sql`${match.score} * log((${v.viewsCount} + ${constant(R.viewsOffset)})::double precision) / (1.0 + ${ageDays} / ${constant(R.recencyScaleDays)})`,
      date: epochOf(v.createdAt),
      views: sql`${v.viewsCount}`,
    };
  },
  rows: async (db, where, key, limit) => {
    const rows = await db
      .select({ video: getTableColumns(v), key })
      .from(v)
      .where(where)
      .orderBy(desc(key), desc(v.id))
      .limit(limit);
    return rows.map(({ video, key }) => ({ kind: 'video', key, id: video.id, video }));
  },
});

export const channelSource = sourceOf({
  kind: 'channel',
  table: ch,
  id: ch.id,
  match: (query) => {
    const wanted = searchHandleOf(query.text);
    const exact = sql`(lower(${ch.handle}) = ${wanted} or lower(${ch.displayName}) = ${wanted})`;
    const text = textMatch(query.mode, query.text, searchVectors.channels, [
      ch.handle,
      ch.displayName,
    ]);
    return { ...text, exact };
  },
  scope: (_query, match) => or(match.where, match.exact),
  keys: (_query, match) => {
    const pinned = sql`case when ${match.exact} then ${constant(R.pinnedChannelBonus)} else 0 end`;
    return {
      relevance: sql`${match.score} * log((${ch.subscriberCount} + ${constant(R.subscribersOffset)})::double precision) * ${constant(R.channelBoost)} + ${pinned}`,
      date: epochOf(ch.createdAt),
      views: sql`${ch.subscriberCount}`,
    };
  },
  rows: async (db, where, key, limit) => {
    const rows = await db
      .select({ channel: getTableColumns(ch), key })
      .from(ch)
      .where(where)
      .orderBy(desc(key), desc(ch.id))
      .limit(limit);
    return rows.map(({ channel, key }) => ({ kind: 'channel', key, id: channel.id, channel }));
  },
});

const stats = new QueryBuilder()
  .select({
    videoCount: sql<number>`count(*)::int`.as('video_count'),
    views: sql<number>`coalesce(sum(${v.viewsCount}), 0)`.as('views'),
    coverKey: sql<
      string | null
    >`(array_agg(${v.posterKey} order by ${pi.position}, ${pi.id}))[1]`.as('cover_key'),
  })
  .from(pi)
  .innerJoin(v, eq(v.id, pi.videoId))
  .where(
    drizzleWhere(
      eq(pi.playlistId, p.id),
      watchableVideoScope(null),
      eq(v.status, PUBLIC_FEED_STATUS)
    )
  )
  .as('stats');

export const playlistSource = sourceOf({
  kind: 'playlist',
  table: p,
  id: p.id,
  match: (query) => textMatch(query.mode, query.text, searchVectors.playlists, [p.title]),
  scope: (_query, match) =>
    drizzleWhere(
      playlistReadScope(null),
      sql`${p.visibility} = 'public' and not ${p.isSystem}`,
      match.where
    ),
  keys: (_query, match) => ({
    relevance: sql`${match.score} * log((${stats.videoCount} + ${constant(R.playlistVideosOffset)})::double precision)`,
    date: epochOf(p.createdAt),
    views: sql`${stats.views}`,
  }),
  rows: async (db, where, key, limit) => {
    const rows = await db
      .select({
        playlist: getTableColumns(p),
        videoCount: stats.videoCount,
        coverKey: stats.coverKey,
        key,
        ...channelCardColumns,
      })
      .from(p)
      .innerJoinLateral(stats, sql`true`)
      .leftJoin(ch, eq(ch.userId, p.ownerId))
      .where(where)
      .orderBy(desc(key), desc(p.id))
      .limit(limit);
    return rows.map(({ playlist, videoCount, coverKey, key, ...owner }) => ({
      kind: 'playlist',
      key,
      id: playlist.id,
      card: { playlist: toPlaylist(playlist), owner: toChannelCard(owner), videoCount, coverKey },
    }));
  },
});

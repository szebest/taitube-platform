import type { SearchHit, SearchQuery } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { PUBLIC_FEED_STATUS, SEARCH_RANKING, searchHandleOf } from '@vp/domain';
import { SECONDS_PER_DAY } from '@vp/domain/time';
import { type SQL, count, desc, eq, getTableColumns, or, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
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
import { afterCursor, constant, epochOf, instantOf, sortKey, textMatch } from './search-query';
import type { PostgresDatabase } from './types';

const { videos: v, channels: ch, playlists: p, playlistItems: pi, searchVectors } = schema;
const R = SEARCH_RANKING;

/** One kind's share of a search: the page after the cursor, and how many rows match at all. */
export interface SearchSource {
  hits(db: PostgresDatabase, query: SearchQuery): Promise<SearchHit[]>;
  total(db: PostgresDatabase, query: SearchQuery): Promise<number>;
}

async function countWhere(db: PostgresDatabase, table: PgTable, where: SQL | undefined) {
  const [row] = await db.select({ n: count() }).from(table).where(where);
  return row?.n ?? 0;
}

function videoScope(query: SearchQuery, match: SQL): SQL | undefined {
  return drizzleWhere(
    videoReadScope(null),
    notDeletedScope(v),
    publicVisibilityScope(v),
    eq(v.status, PUBLIC_FEED_STATUS),
    query.categoryId ? eq(v.categoryId, query.categoryId) : undefined,
    match
  );
}

export const videoSource: SearchSource = {
  async hits(db, query) {
    const match = textMatch(query.mode, query.text, searchVectors.videos, [v.title]);
    const ageDays = sql`greatest(0, extract(epoch from (${instantOf(query.instant)} - ${v.createdAt})) / ${constant(SECONDS_PER_DAY)})`;
    const key = sortKey(query.sort, {
      relevance: sql`${match.score} * log((${v.viewsCount} + ${constant(R.viewsOffset)})::double precision) / (1.0 + ${ageDays} / ${constant(R.recencyScaleDays)})`,
      date: epochOf(v.createdAt),
      views: sql`${v.viewsCount}`,
    });
    const rows = await db
      .select({ video: getTableColumns(v), key })
      .from(v)
      .where(
        drizzleWhere(videoScope(query, match.where), afterCursor('video', key, v.id, query.cursor))
      )
      .orderBy(desc(key), desc(v.id))
      .limit(query.limit + 1);
    return rows.map(({ video, key }) => ({ kind: 'video', key, id: video.id, video }));
  },
  async total(db, query) {
    const match = textMatch(query.mode, query.text, searchVectors.videos, [v.title]);
    return countWhere(db, v, videoScope(query, match.where));
  },
};

function channelMatch(query: SearchQuery) {
  const wanted = searchHandleOf(query.text);
  const exact = sql`(lower(${ch.handle}) = ${wanted} or lower(${ch.displayName}) = ${wanted})`;
  const match = textMatch(query.mode, query.text, searchVectors.channels, [
    ch.handle,
    ch.displayName,
  ]);
  return { exact, where: or(match.where, exact), score: match.score };
}

export const channelSource: SearchSource = {
  async hits(db, query) {
    const match = channelMatch(query);
    const pinned = sql`case when ${match.exact} then ${constant(R.pinnedChannelBonus)} else 0 end`;
    const key = sortKey(query.sort, {
      relevance: sql`${match.score} * log((${ch.subscriberCount} + ${constant(R.subscribersOffset)})::double precision) * ${constant(R.channelBoost)} + ${pinned}`,
      date: epochOf(ch.createdAt),
      views: sql`${ch.subscriberCount}`,
    });
    const rows = await db
      .select({ channel: getTableColumns(ch), key })
      .from(ch)
      .where(drizzleWhere(match.where, afterCursor('channel', key, ch.id, query.cursor)))
      .orderBy(desc(key), desc(ch.id))
      .limit(query.limit + 1);
    return rows.map(({ channel, key }) => ({ kind: 'channel', key, id: channel.id, channel }));
  },
  async total(db, query) {
    return countWhere(db, ch, channelMatch(query).where);
  },
};

function playlistScope(match: SQL): SQL | undefined {
  return drizzleWhere(
    playlistReadScope(null),
    publicVisibilityScope(p),
    sql`not ${p.isSystem}`,
    match
  );
}

/** What an anonymous viewer of the playlist page would see of it: the videos they may watch. */
function playlistStats(db: PostgresDatabase) {
  return db
    .select({
      videoCount: sql<number>`count(*)::int`.as('video_count'),
      views: sql<number>`coalesce(sum(${v.viewsCount}), 0)`.as('views'),
      coverKey: sql<
        string | null
      >`(array_agg(${v.posterKey} order by ${pi.position}, ${pi.id}))[1]`.as('cover_key'),
    })
    .from(pi)
    .innerJoin(v, eq(v.id, pi.videoId))
    .where(drizzleWhere(eq(pi.playlistId, p.id), watchableVideoScope(null)))
    .as('stats');
}

export const playlistSource: SearchSource = {
  async hits(db, query) {
    const match = textMatch(query.mode, query.text, searchVectors.playlists, [p.title]);
    const stats = playlistStats(db);
    const key = sortKey(query.sort, {
      relevance: sql`${match.score} * log((${stats.videoCount} + ${constant(R.playlistVideosOffset)})::double precision)`,
      date: epochOf(p.createdAt),
      views: sql`${stats.views}`,
    });
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
      .where(
        drizzleWhere(playlistScope(match.where), afterCursor('playlist', key, p.id, query.cursor))
      )
      .orderBy(desc(key), desc(p.id))
      .limit(query.limit + 1);
    return rows.map(({ playlist, videoCount, coverKey, key, ...owner }) => ({
      kind: 'playlist',
      key,
      id: playlist.id,
      card: { playlist: toPlaylist(playlist), owner: toChannelCard(owner), videoCount, coverKey },
    }));
  },
  async total(db, query) {
    const match = textMatch(query.mode, query.text, searchVectors.playlists, [p.title]);
    return countWhere(db, p, playlistScope(match.where));
  },
};

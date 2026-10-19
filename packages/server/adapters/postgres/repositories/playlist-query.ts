import * as schema from '@vp/db';
import type { ListPublicPlaylistsOptions } from '@vp/core/repositories';
import {
  PLAYLIST_PREVIEW_THUMBNAILS,
  type Playlist,
  type PlaylistEntry,
  type PositionWrite,
  type Video,
} from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { asc, count, desc, eq, getTableColumns, isNotNull, sql } from 'drizzle-orm';
import { drizzleWhere, keysetBefore, watchableVideoScope } from '../scopes/index';
import { type ChannelCardRow, channelCardColumns, toChannelCard } from './channel-card-query';
import type { PostgresDatabase } from './types';

const { playlists: p, playlistItems: pi, videos: v, channels: ch } = schema;

export function toPlaylist(row: typeof p.$inferSelect): Playlist {
  return row;
}

/**
 * Ranks every item before the viewer's scope drops any, so a hidden video keeps its slot and the
 * `position` a client sends back to reorder means the same item on the server.
 */
export function entriesOf(db: PostgresDatabase, playlistId: string, viewer: UserContext | null) {
  const ranked = db
    .select({
      id: pi.id,
      videoId: pi.videoId,
      addedAt: pi.addedAt,
      position: sql<number>`(row_number() over (order by ${pi.position}, ${pi.id}) - 1)::int`.as(
        'ordinal'
      ),
    })
    .from(pi)
    .where(eq(pi.playlistId, playlistId))
    .as('ranked');

  return db
    .select({
      id: ranked.id,
      videoId: ranked.videoId,
      addedAt: ranked.addedAt,
      position: ranked.position,
      video: getTableColumns(v),
      ...channelCardColumns,
    })
    .from(ranked)
    .innerJoin(v, eq(v.id, ranked.videoId))
    .leftJoin(ch, eq(ch.userId, v.ownerId))
    .where(watchableVideoScope(viewer))
    .orderBy(asc(ranked.position));
}

interface EntryRow extends ChannelCardRow {
  id: string;
  videoId: string;
  addedAt: Date;
  position: number;
  video: Video;
}

export function toPlaylistEntry({
  id,
  videoId,
  addedAt,
  position,
  video,
  ...card
}: EntryRow): PlaylistEntry {
  return { id, videoId, addedAt, position, video, channel: toChannelCard(card) };
}

/** Every slot in playlist order, `hidden` where the viewer may not watch the video. */
export function reorderSlots(tx: PostgresDatabase, playlistId: string, viewer: UserContext) {
  const watchable = watchableVideoScope(viewer) ?? sql`true`;
  return tx
    .select({
      id: pi.id,
      position: pi.position,
      hidden: sql<boolean>`not coalesce(${watchable}, false)`.mapWith(Boolean),
    })
    .from(pi)
    .innerJoin(v, eq(v.id, pi.videoId))
    .where(eq(pi.playlistId, playlistId))
    .orderBy(asc(pi.position), asc(pi.id));
}

/** One statement however many rows move: a renumber is a single round trip. */
export async function writePositions(
  tx: PostgresDatabase,
  playlistId: string,
  writes: readonly PositionWrite[]
): Promise<void> {
  if (writes.length === 0) return;
  const values = sql.join(
    writes.map((write) => sql`(${write.id}::uuid, ${write.position}::integer)`),
    sql`, `
  );
  await tx.execute(
    sql`update ${pi} set position = moved.position from (values ${values}) as moved(id, position)
        where ${pi.id} = moved.id and ${pi.playlistId} = ${playlistId}`
  );
}

/** One owner's public playlists, `limit + 1` of them, each with what an anonymous visitor may watch. */
export function publicPlaylistsOf(
  db: PostgresDatabase,
  ownerId: string,
  { cursor, limit }: ListPublicPlaylistsOptions
) {
  const visible = watchableVideoScope(null);
  const videoCount = db
    .select({ n: count() })
    .from(pi)
    .innerJoin(v, eq(v.id, pi.videoId))
    .where(drizzleWhere(eq(pi.playlistId, p.id), visible));
  const posterKeys = db
    .select({ key: v.posterKey })
    .from(pi)
    .innerJoin(v, eq(v.id, pi.videoId))
    .where(drizzleWhere(eq(pi.playlistId, p.id), isNotNull(v.posterKey), visible))
    .orderBy(asc(pi.position), asc(pi.id))
    .limit(PLAYLIST_PREVIEW_THUMBNAILS);
  // `now()` stamps microseconds, a cursor carries milliseconds: on the raw column it skips rows.
  const changedAt = sql`date_trunc('milliseconds', ${p.updatedAt})`;

  return db
    .select({
      ...getTableColumns(p),
      videoCount: sql<number>`(${videoCount})`.mapWith(Number),
      posterKeys: sql<string[]>`array(${posterKeys})`,
    })
    .from(p)
    .where(
      drizzleWhere(
        eq(p.ownerId, ownerId),
        eq(p.visibility, 'public'),
        eq(p.isSystem, false),
        keysetBefore(
          changedAt,
          p.id,
          cursor && { sort: sql`${cursor.updatedAt.toISOString()}::timestamptz`, tie: cursor.id }
        )
      )
    )
    .orderBy(desc(changedAt), desc(p.id))
    .limit(limit + 1);
}

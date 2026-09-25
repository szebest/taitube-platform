import * as schema from '@vp/db';
import type { Playlist, PlaylistEntry, PositionWrite, Video } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { asc, eq, getTableColumns, sql } from 'drizzle-orm';
import { watchableVideoScope } from '../scopes/index';
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

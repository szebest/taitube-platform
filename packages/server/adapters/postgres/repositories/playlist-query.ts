import type {
  ListPlaylistItemsOptions,
  ListPublicPlaylistsOptions,
  SortedPlaylistEntry,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  PLAYLIST_PREVIEW_THUMBNAILS,
  type Playlist,
  type PlaylistEntry,
  type PlaylistSection,
  type PositionWrite,
  type StoredPlaylistItem,
} from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  isNotNull,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { toVideoRecord } from '../mappers/video.mapper';
import {
  drizzleWhere,
  keysetBefore,
  keysetPast,
  msTimestamp,
  watchableVideoScope,
} from '../scopes/index';
import { channelCardColumns, toChannelCard } from './channel-card-query';
import { sortKeyOf } from './playlist-item-sort';
import type { PostgresDatabase } from './types';

const { playlists: p, playlistItems: pi, videos: v, channels: ch } = schema;

export function toPlaylist(row: typeof p.$inferSelect): Playlist {
  const { id, ownerId, title, description, visibility, kind, isSystem } = row;
  const { customThumbnailKey, createdAt, updatedAt } = row;
  return {
    id,
    ownerId,
    title,
    description,
    visibility,
    kind,
    isSystem,
    customThumbnailKey,
    createdAt,
    updatedAt,
  };
}

const adder = alias(ch, 'adder_channel');

/** Every row with its 0-based place, sections and hidden videos counted. */
export function rankedItems(db: PostgresDatabase, playlistId: string) {
  return db
    .select({
      ...getTableColumns(pi),
      ordinal: sql<number>`(row_number() over (order by ${pi.position}, ${pi.id}) - 1)::int`.as(
        'ordinal'
      ),
    })
    .from(pi)
    .where(eq(pi.playlistId, playlistId))
    .as('ranked');
}

type Ranked = ReturnType<typeof rankedItems>;

/** A ranked row with its video, the video's channel and the adder's primary channel, left-joined. */
function rowsFrom<E extends Record<string, SQL>>(
  db: PostgresDatabase,
  ranked: Ranked,
  extra: E = {} as E
) {
  return db
    .select({
      ...extra,
      item: {
        id: ranked.id,
        kind: ranked.kind,
        videoId: ranked.videoId,
        title: ranked.title,
        addedAt: ranked.addedAt,
        addedBy: ranked.addedBy,
        note: ranked.note,
        startMs: ranked.startMs,
        endMs: ranked.endMs,
        position: ranked.ordinal,
      },
      video: getTableColumns(v),
      ...channelCardColumns,
      adder: {
        channelId: adder.id,
        handle: adder.handle,
        displayName: adder.displayName,
        avatarUrl: adder.avatarUrl,
      },
    })
    .from(ranked)
    .leftJoin(v, eq(v.id, ranked.videoId))
    .leftJoin(ch, eq(ch.id, v.channelId))
    .leftJoin(adder, and(eq(adder.userId, ranked.addedBy), eq(adder.isPrimary, true)));
}

/**
 * Ranks every row before the viewer's scope drops any, so an item keeps its slot and the
 * `position` a client sends back to reorder means the same row here.
 */
export function rowsOf(db: PostgresDatabase, playlistId: string, viewer: UserContext | null) {
  const ranked = rankedItems(db, playlistId);
  return rowsFrom(db, ranked)
    .where(or(eq(ranked.kind, 'section'), watchableVideoScope(viewer)))
    .orderBy(asc(ranked.ordinal));
}

type PlaylistRow = Awaited<ReturnType<typeof rowsOf>>[number];

/** The ranked rows split into the videos the viewer may watch and the sections between them. */
export function toDetailItems(rows: readonly PlaylistRow[]): {
  items: PlaylistEntry[];
  sections: PlaylistSection[];
} {
  const items: PlaylistEntry[] = [];
  const sections: PlaylistSection[] = [];
  for (const { item, video, adder: adderCard, ...card } of rows) {
    const { id, videoId, title, addedAt, addedBy, note, startMs, endMs, position } = item;
    if (video && videoId) {
      items.push({
        id,
        videoId,
        position,
        addedAt,
        addedBy:
          addedBy === null
            ? null
            : { userId: addedBy, channel: adderCard && toChannelCard(adderCard) },
        note,
        startMs,
        endMs,
        video: toVideoRecord(video),
        channel: toChannelCard(card),
      });
    } else if (title !== null) {
      sections.push({ id, title, position, addedBy });
    }
  }
  return { items, sections };
}

export function toStoredItem(row: typeof pi.$inferSelect): StoredPlaylistItem {
  const { id, kind, videoId, title, addedBy, note, startMs, endMs, position } = row;
  return { id, kind, videoId, title, addedBy, note, startMs, endMs, position };
}

/** Every slot in playlist order, `hidden` where the viewer may not watch the video; a section shows. */
export function reorderSlots(tx: PostgresDatabase, playlistId: string, viewer: UserContext) {
  const watchable = watchableVideoScope(viewer) ?? sql`true`;
  return tx
    .select({
      id: pi.id,
      position: pi.position,
      hidden: sql<boolean>`${pi.kind} = 'video' and not coalesce(${watchable}, false)`.mapWith(
        Boolean
      ),
    })
    .from(pi)
    .leftJoin(v, eq(v.id, pi.videoId))
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
  const changedAt = msTimestamp(p.updatedAt);

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
        keysetBefore(changedAt, p.id, cursor && { sort: cursor.updatedAt, tie: cursor.id })
      )
    )
    .orderBy(desc(changedAt), desc(p.id))
    .limit(limit + 1);
}

/** The video items the viewer may watch, in `sort`, after the cursor, each with its key. */
export async function sortedItems(
  db: PostgresDatabase,
  playlistId: string,
  viewer: UserContext | null,
  { sort, cursor, limit }: ListPlaylistItemsOptions
): Promise<SortedPlaylistEntry[]> {
  const ranked = rankedItems(db, playlistId);
  const { key, order } = sortKeyOf(sort, viewer, ranked);
  const direction = order === 'asc' ? asc : desc;
  const rows = await rowsFrom(db, ranked, { sortKey: key })
    .where(
      drizzleWhere(
        eq(ranked.kind, 'video'),
        watchableVideoScope(viewer),
        keysetPast(key, ranked.id, cursor && { sort: cursor.key, tie: cursor.id }, order)
      )
    )
    .orderBy(direction(key), direction(ranked.id))
    .limit(limit + 1);
  const { items } = toDetailItems(rows);
  return items.map((entry, index) => ({ entry, key: keyOf(rows[index]?.sortKey) }));
}

function keyOf(value: unknown): string | number {
  return typeof value === 'number' || typeof value === 'string' ? value : 0;
}


import type {
  AppendItemOutcome,
  NewPlaylistItem,
  PlaylistItemTarget,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type RemovedPlaylistItem,
  type StoredPlaylistItem,
  appendPositions,
} from '@vp/domain';
import { assertNever } from '@kit/result';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { toStoredItem, writePositions } from './playlist-query';
import type { PostgresDatabase } from './types';

const { playlists: p, playlistItems: pi, videos: v } = schema;

export async function lockPlaylist(tx: PostgresDatabase, playlistId: string): Promise<boolean> {
  const [row] = await tx.select({ id: p.id }).from(p).where(eq(p.id, playlistId)).for('update');
  return Boolean(row);
}

export async function touchPlaylist(tx: PostgresDatabase, playlistId: string): Promise<void> {
  await tx
    .update(p)
    .set({ updatedAt: sql`now()` })
    .where(eq(p.id, playlistId));
}

/** Every row in playlist order, or only `itemIds` when given. */
export function storedItems(
  tx: PostgresDatabase,
  playlistId: string,
  itemIds?: readonly string[]
) {
  return tx
    .select()
    .from(pi)
    .where(
      and(
        eq(pi.playlistId, playlistId),
        itemIds === undefined ? undefined : inArray(pi.id, [...itemIds])
      )
    )
    .orderBy(asc(pi.position), asc(pi.id));
}

export type NewRow =
  | ({ kind: 'video' } & NewPlaylistItem)
  | { kind: 'section'; id: string; title: string; addedBy: string | null };

/** Positions for `count` new rows after the last one, respacing the playlist first if it must. */
async function nextPositions(tx: PostgresDatabase, playlistId: string, count: number) {
  const rows = await storedItems(tx, playlistId);
  const { renumber, positions } = appendPositions(rows, count);
  await writePositions(tx, playlistId, renumber);
  return positions;
}

/**
 * Appends in order, under the caller's lock on the playlist. A video already held is `present` and a
 * video that no longer exists is `video-missing`; neither takes a slot.
 */
export async function appendRows(
  tx: PostgresDatabase,
  playlistId: string,
  rows: readonly NewRow[]
): Promise<Map<string, AppendItemOutcome>> {
  const videoIds = rows.flatMap((row) => (row.kind === 'video' ? [row.videoId] : []));
  const existing =
    videoIds.length === 0
      ? []
      : await tx.select({ id: v.id }).from(v).where(inArray(v.id, videoIds)).for('share');
  const held =
    videoIds.length === 0
      ? []
      : await tx
          .select({ videoId: pi.videoId })
          .from(pi)
          .where(and(eq(pi.playlistId, playlistId), inArray(pi.videoId, videoIds)));
  const exists = new Set(existing.map((row) => row.id));
  const taken = new Set(held.map((row) => row.videoId));

  const outcomes = new Map<string, AppendItemOutcome>();
  const inserts: NewRow[] = [];
  for (const row of rows) {
    if (row.kind === 'section') {
      inserts.push(row);
      continue;
    }
    if (!exists.has(row.videoId)) outcomes.set(row.id, 'video-missing');
    else if (taken.has(row.videoId)) outcomes.set(row.id, 'present');
    else {
      taken.add(row.videoId);
      outcomes.set(row.id, 'added');
      inserts.push(row);
    }
  }
  if (inserts.length === 0) return outcomes;

  const positions = await nextPositions(tx, playlistId, inserts.length);
  await tx.insert(pi).values(
    inserts.map((row, index) => ({ ...row, playlistId, position: positions[index] ?? 0 }))
  );
  return outcomes;
}

function targetWhere(playlistId: string, target: PlaylistItemTarget) {
  switch (target.by) {
    case 'item':
      return and(eq(pi.playlistId, playlistId), eq(pi.id, target.itemId));
    case 'video':
      return and(eq(pi.playlistId, playlistId), eq(pi.videoId, target.videoId));
    default:
      return assertNever(target, 'PlaylistItemTarget');
  }
}

export async function deleteRow(
  tx: PostgresDatabase,
  playlistId: string,
  target: PlaylistItemTarget
): Promise<StoredPlaylistItem | null> {
  const [row] = await tx.delete(pi).where(targetWhere(playlistId, target)).returning();
  return row ? toStoredItem(row) : null;
}

export function removedOf(item: StoredPlaylistItem): RemovedPlaylistItem {
  const { id, videoId, title, addedBy, note, startMs, endMs } = item;
  return { itemId: id, videoId, title, addedBy, note, startMs, endMs };
}

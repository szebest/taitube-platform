import type {
  AppendItemOutcome,
  MergeOutcome,
  MergeSource,
  NewPlaylistItem,
  RestoreItemOutcome,
  TransferOutcome,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { RestorablePlaylistActivity, StoredPlaylistItem } from '@vp/domain';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { recordPlaylistChange } from './playlist-change';
import {
  type NewRow,
  appendRows,
  lockPlaylist,
  removedOf,
  touchPlaylist,
} from './playlist-item-writes';
import type { PostgresDatabase } from './types';

const { playlists: p, playlistItems: pi, playlistActivity: pa } = schema;

/** Appends the videos under the caller's lock and logs each one that went in. */
export async function appendLogged(
  tx: PostgresDatabase,
  playlistId: string,
  items: readonly NewPlaylistItem[],
  actorId: string
): Promise<Map<string, AppendItemOutcome>> {
  const outcomes = await appendRows(
    tx,
    playlistId,
    items.map((item): NewRow => ({ kind: 'video', ...item }))
  );
  const added = items.filter((item) => outcomes.get(item.id) === 'added');
  if (added.length > 0) {
    await touchPlaylist(tx, playlistId);
    await recordPlaylistChange(
      tx,
      playlistId,
      actorId,
      added.map(({ id, videoId }) => ({
        action: 'item_added' as const,
        target: { itemId: id, videoId },
      }))
    );
  }
  return outcomes;
}

export async function logReorder(
  tx: PostgresDatabase,
  playlistId: string,
  actorId: string,
  count: number
): Promise<void> {
  await touchPlaylist(tx, playlistId);
  await recordPlaylistChange(tx, playlistId, actorId, [
    { action: 'items_reordered', target: { count } },
  ]);
}

/** The copy of an item in another playlist: a new row, credited to whoever copied it. */
function copyOf(item: StoredPlaylistItem, actorId: string): NewRow {
  const { kind, videoId, title, note, startMs, endMs } = item;
  return kind === 'video' && videoId !== null
    ? { kind: 'video', id: uuidv7(), videoId, addedBy: actorId, note, startMs, endMs }
    : { kind: 'section', id: uuidv7(), title: title ?? '', addedBy: actorId };
}

async function heldIn(
  tx: PostgresDatabase,
  playlistId: string,
  items: readonly StoredPlaylistItem[]
): Promise<Set<string>> {
  if (items.length === 0) return new Set();
  const rows = await tx
    .select({ id: pi.id })
    .from(pi)
    .where(
      and(
        eq(pi.playlistId, playlistId),
        inArray(
          pi.id,
          items.map((item) => item.id)
        )
      )
    );
  return new Set(rows.map((row) => row.id));
}

/**
 * Copies into the target, and on a move takes out of the source what went in or was there already,
 * both playlists locked in id order so two opposite moves cannot deadlock.
 */
export async function transferRows(
  tx: PostgresDatabase,
  sourceId: string,
  targetId: string,
  items: readonly StoredPlaylistItem[],
  mode: 'move' | 'copy',
  actorId: string
): Promise<TransferOutcome> {
  for (const id of [sourceId, targetId].sort()) {
    if (!(await lockPlaylist(tx, id)) && id === targetId) return null;
  }
  const held = await heldIn(tx, sourceId, items);
  const moving = items.filter((item) => held.has(item.id));
  const copies = new Map(moving.map((item) => [item.id, copyOf(item, actorId)]));
  const appended = await appendRows(tx, targetId, [...copies.values()]);
  const outcomeOf = (item: StoredPlaylistItem) =>
    appended.get(copies.get(item.id)?.id ?? '') ?? 'added';

  const added = moving.filter((item) => outcomeOf(item) === 'added');
  if (added.length > 0) {
    await touchPlaylist(tx, targetId);
    await recordPlaylistChange(
      tx,
      targetId,
      actorId,
      added.flatMap((item) => {
        const copy = copies.get(item.id);
        return copy?.kind === 'video'
          ? [{ action: 'item_added' as const, target: { itemId: copy.id, videoId: copy.videoId } }]
          : [];
      })
    );
  }
  if (mode === 'move') {
    await moveOut(
      tx,
      sourceId,
      moving.filter((item) => outcomeOf(item) !== 'video-missing'),
      actorId
    );
  }
  return new Map(
    items.map((item) => [item.id, held.has(item.id) ? outcomeOf(item) : 'source-missing'])
  );
}

const landed = (outcome: AppendItemOutcome | 'source-missing') =>
  outcome === 'added' || outcome === 'present';

/** Every playlist locked up front in id order, so a merge cannot deadlock a move between two of them. */
export async function mergeRows(
  tx: PostgresDatabase,
  targetId: string,
  sources: readonly MergeSource[],
  actorId: string
): Promise<MergeOutcome> {
  const ids = [...new Set([targetId, ...sources.map((source) => source.sourceId)])].sort();
  for (const id of ids) {
    if (!(await lockPlaylist(tx, id)) && id === targetId) return null;
  }
  const outcomes = new Map<string, NonNullable<TransferOutcome>>();
  for (const { sourceId, items, deleteIfLanded } of sources) {
    const outcome = await transferRows(tx, sourceId, targetId, items, 'copy', actorId);
    if (!outcome) return null;
    outcomes.set(sourceId, outcome);
    if (deleteIfLanded && [...outcome.values()].every(landed)) {
      await tx.delete(p).where(and(eq(p.id, sourceId), eq(p.isSystem, false)));
    }
  }
  return outcomes;
}

async function moveOut(
  tx: PostgresDatabase,
  sourceId: string,
  leaving: readonly StoredPlaylistItem[],
  actorId: string
): Promise<void> {
  if (leaving.length === 0) return;
  await tx.delete(pi).where(
    and(
      eq(pi.playlistId, sourceId),
      inArray(
        pi.id,
        leaving.map((item) => item.id)
      )
    )
  );
  await touchPlaylist(tx, sourceId);
  await recordPlaylistChange(
    tx,
    sourceId,
    actorId,
    leaving.map((item) => ({ action: 'item_removed' as const, target: removedOf(item) }))
  );
}

/** Puts a removed row back at the end as it stood, under a new id, and logs the restore. */
export async function restoreRow(
  tx: PostgresDatabase,
  playlistId: string,
  activity: RestorablePlaylistActivity,
  actorId: string
): Promise<RestoreItemOutcome> {
  if (!(await lockPlaylist(tx, playlistId))) return 'playlist-missing';
  const [restoredAlready] = await tx
    .select({ id: pa.id })
    .from(pa)
    .where(
      and(
        eq(pa.playlistId, playlistId),
        eq(pa.action, 'restored'),
        sql`${pa.target}->>'activityId' = ${activity.id}`
      )
    )
    .limit(1);
  if (restoredAlready) return 'present';
  const { videoId, title, addedBy, note, startMs, endMs } = activity.target;
  const row: NewRow =
    videoId === null
      ? { kind: 'section', id: uuidv7(), title: title ?? '', addedBy }
      : { kind: 'video', id: uuidv7(), videoId, addedBy, note, startMs, endMs };
  const outcome = (await appendRows(tx, playlistId, [row])).get(row.id) ?? 'added';
  if (outcome !== 'added') return outcome;

  await touchPlaylist(tx, playlistId);
  await recordPlaylistChange(tx, playlistId, actorId, [
    { action: 'restored', target: { activityId: activity.id, itemId: row.id } },
  ]);
  return 'restored';
}

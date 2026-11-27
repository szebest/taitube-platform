import { assertNever } from '@kit/result';
import type { NewPlaylistItem, PlaylistItemCursor } from '@vp/core/repositories';
import {
  type PlaylistItemSort,
  type RemovedPlaylistItem,
  type StoredPlaylistItem,
  type Video,
  unwatchedFirstKey,
} from '@vp/domain';

export interface StoredItem extends StoredPlaylistItem {
  playlistId: string;
  addedAt: Date;
}

export function byPosition(a: StoredItem, b: StoredItem): number {
  return a.position - b.position || a.id.localeCompare(b.id);
}

export function toStored(item: StoredItem): StoredPlaylistItem {
  const { id, kind, videoId, title, addedBy, note, startMs, endMs, position } = item;
  return { id, kind, videoId, title, addedBy, note, startMs, endMs, position };
}

export type NewRow =
  | ({ kind: 'video' } & NewPlaylistItem)
  | { kind: 'section'; id: string; title: string; addedBy: string | null };

export function storedRow(row: NewRow, playlistId: string, position: number): StoredItem {
  const video = row.kind === 'video' ? row : null;
  return {
    id: row.id,
    playlistId,
    kind: row.kind,
    videoId: video?.videoId ?? null,
    title: row.kind === 'section' ? row.title : null,
    addedBy: row.addedBy,
    note: video?.note ?? null,
    startMs: video?.startMs ?? null,
    endMs: video?.endMs ?? null,
    position,
    addedAt: new Date(),
  };
}

/** The copy of an item in another playlist: a new row, credited to whoever copied it. */
export function copyOf(item: StoredPlaylistItem, actorId: string, id: string): NewRow {
  const { kind, videoId, title, note, startMs, endMs } = item;
  return kind === 'video' && videoId !== null
    ? { kind: 'video', id, videoId, addedBy: actorId, note, startMs, endMs }
    : { kind: 'section', id, title: title ?? '', addedBy: actorId };
}

/** A removed row as it stood, back under a new id. */
export function restoredRow(removed: RemovedPlaylistItem, id: string): NewRow {
  const { videoId, title, addedBy, note, startMs, endMs } = removed;
  return videoId === null
    ? { kind: 'section', id, title: title ?? '', addedBy }
    : { kind: 'video', id, videoId, addedBy, note, startMs, endMs };
}

export function removedOf(item: StoredPlaylistItem): RemovedPlaylistItem {
  const { id, videoId, title, addedBy, note, startMs, endMs } = item;
  return { itemId: id, videoId, title, addedBy, note, startMs, endMs };
}

export interface SortFacts {
  video: Video;
  channelName: string;
  watched: boolean;
}

export const SORT_ORDER: Readonly<Record<PlaylistItemSort, 'asc' | 'desc'>> = {
  manual: 'asc',
  added: 'desc',
  duration: 'asc',
  channel: 'asc',
  unwatched_first: 'asc',
};

/** The scalar the postgres sort compares, computed the same way. */
export function sortKeyOf(
  sort: PlaylistItemSort,
  item: StoredItem,
  facts: SortFacts
): string | number {
  switch (sort) {
    case 'manual':
      return item.position;
    case 'added':
      return item.addedAt.getTime();
    case 'duration':
      return facts.video.durationMs ?? 0;
    case 'channel':
      return facts.channelName.toLowerCase();
    case 'unwatched_first':
      return unwatchedFirstKey(facts.watched, item.position);
    default:
      return assertNever(sort, 'PlaylistItemSort');
  }
}

function compareKeys(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (String(a) === String(b)) return 0;
  return String(a) < String(b) ? -1 : 1;
}

/** Orders `(key, id)` pairs the way the keyset walks them, `desc` reversing both. */
export function compareSorted(
  a: { key: string | number; id: string },
  b: { key: string | number; id: string },
  order: 'asc' | 'desc'
): number {
  const delta = compareKeys(a.key, b.key) || a.id.localeCompare(b.id);
  return order === 'asc' ? delta : -delta;
}

export function isPast(
  row: { key: string | number; id: string },
  cursor: PlaylistItemCursor | null,
  order: 'asc' | 'desc'
): boolean {
  return !cursor || compareSorted(row, cursor, order) > 0;
}

import {
  type PlaylistReorder,
  type PositionWrite,
  type PositionedItem,
  movePositions,
  renumberPositions,
} from '@vp/domain';
import { type VersionConflict, versionConflict } from '@vp/errors';
import { type Result, assertNever, err, ok } from '@vp/result';
import { type PlaylistItemNotFound, playlistItemNotFound } from './failures';

export type ReorderPlaylistFailure = PlaylistItemNotFound | VersionConflict;

function isSameSet(itemIds: readonly string[], items: readonly PositionedItem[]): boolean {
  const named = new Set(itemIds);
  return (
    named.size === itemIds.length &&
    named.size === items.length &&
    items.every((item) => named.has(item.id))
  );
}

/**
 * The writes a reorder needs, against the items as they stand inside the write transaction. A
 * full reindex must name exactly the items there are: anything else was drawn from a stale view
 * of the playlist, and applying it would drop or duplicate an item.
 */
export function decidePlaylistReorder(
  playlistId: string,
  items: readonly PositionedItem[],
  change: PlaylistReorder
): Result<PositionWrite[], ReorderPlaylistFailure> {
  switch (change.type) {
    case 'move': {
      const writes = movePositions(items, change.itemId, change.index);
      return writes ? ok(writes) : err(playlistItemNotFound(playlistId, change.itemId));
    }
    case 'reindex':
      return isSameSet(change.itemIds, items)
        ? ok(renumberPositions(change.itemIds))
        : err(versionConflict(playlistId));
    default:
      return assertNever(change, 'PlaylistReorder');
  }
}

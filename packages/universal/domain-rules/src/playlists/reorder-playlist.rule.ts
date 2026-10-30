import {
  type PlaylistReorder,
  type PositionWrite,
  type ReorderSlot,
  movePositions,
  renumberPositions,
} from '@vp/domain';
import { type VersionConflict, versionConflict } from '@vp/errors';
import { type Result, assertNever, err, ok } from '@vp/result';
import { type PlaylistItemNotFound, playlistItemNotFound } from './failures';

export type ReorderPlaylistFailure = PlaylistItemNotFound | VersionConflict;

function isSameSet(itemIds: readonly string[], slots: readonly ReorderSlot[]): boolean {
  const named = new Set(itemIds);
  return (
    named.size === itemIds.length &&
    named.size === slots.length &&
    slots.every((slot) => named.has(slot.id))
  );
}

/** The caller's order fills the slots they can see; a hidden item stays in its own. */
function fillVisibleSlots(slots: readonly ReorderSlot[], itemIds: readonly string[]): string[] {
  const next = itemIds[Symbol.iterator]();
  return slots.map((slot) => (slot.hidden ? slot.id : (next.next().value ?? slot.id)));
}

/**
 * The writes a reorder needs, against the slots as they stand inside the write transaction. A
 * full reindex must name exactly the items the caller can see: anything else was drawn from a
 * stale view of the playlist, and applying it would drop or duplicate an item.
 */
export function decidePlaylistReorder(
  playlistId: string,
  slots: readonly ReorderSlot[],
  change: PlaylistReorder
): Result<PositionWrite[], ReorderPlaylistFailure> {
  switch (change.type) {
    case 'move': {
      const writes = movePositions(slots, change.itemId, change.index);
      return writes ? ok(writes) : err(playlistItemNotFound(playlistId, change.itemId));
    }
    case 'reindex': {
      const visible = slots.filter((slot) => !slot.hidden);
      return isSameSet(change.itemIds, visible)
        ? ok(renumberPositions(fillVisibleSlots(slots, change.itemIds)))
        : err(versionConflict(playlistId));
    }
    default:
      return assertNever(change, 'PlaylistReorder');
  }
}

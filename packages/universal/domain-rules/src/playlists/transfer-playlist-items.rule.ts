import { type Result, andThen, err, isErr, map, ok } from '@kit/result';
import type { SeatedPlaylist, StoredPlaylistItem } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { type PlaylistItemNotFound, playlistItemNotFound } from './failures';
import {
  type ManagePlaylistFailure,
  decidePlaylistAction,
  decidePlaylistRead,
} from './manage-playlist.rule';

export type PlaylistTransferMode = 'move' | 'copy';

export interface PlaylistTransferInput {
  readonly actor: UserContext;
  readonly source: SeatedPlaylist | null;
  readonly sourceId: string;
  readonly target: SeatedPlaylist | null;
  readonly targetId: string;
  readonly mode: PlaylistTransferMode;
}

/** Copying out needs only a read of the source; anything into the target needs `addItem` there. */
export function decidePlaylistTransfer(
  input: PlaylistTransferInput
): Result<{ source: SeatedPlaylist; target: SeatedPlaylist }, ManagePlaylistFailure> {
  const { actor, source, sourceId, target, targetId } = input;
  return andThen(decidePlaylistRead({ actor, playlist: source, playlistId: sourceId }), (from) =>
    map(
      decidePlaylistAction({ actor, playlist: target, playlistId: targetId }, 'addItem'),
      (to) => ({ source: from, target: to })
    )
  );
}

export type TransferItemFailure = PlaylistItemNotFound | ManagePlaylistFailure;

/**
 * One item of a batch: a section lands only where the actor may `manageItems`, and a move takes the
 * item out of the source, which is `removeItem` on that item.
 */
export function decidePlaylistTransferItem(input: {
  readonly actor: UserContext;
  readonly source: SeatedPlaylist;
  readonly target: SeatedPlaylist;
  readonly itemId: string;
  readonly item: StoredPlaylistItem | null;
  readonly mode: PlaylistTransferMode;
}): Result<StoredPlaylistItem, TransferItemFailure> {
  const { actor, source, target, itemId, item, mode } = input;
  if (!item) return err(playlistItemNotFound(source.id, itemId));
  if (item.kind === 'section') {
    const landing = decidePlaylistAction(
      { actor, playlist: target, playlistId: target.id },
      'manageItems'
    );
    if (isErr(landing)) return landing;
  }
  if (mode === 'copy') return ok(item);
  return andThen(
    decidePlaylistAction({ actor, playlist: source, playlistId: source.id }, 'removeItem', item),
    () => ok(item)
  );
}

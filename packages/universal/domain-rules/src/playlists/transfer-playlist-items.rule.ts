import { type Result, andThen, err, map, ok } from '@kit/result';
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

/** One item of a batch: a move takes it out of the source, which is `removeItem` on that item. */
export function decidePlaylistTransferItem(input: {
  readonly actor: UserContext;
  readonly source: SeatedPlaylist;
  readonly itemId: string;
  readonly item: StoredPlaylistItem | null;
  readonly mode: PlaylistTransferMode;
}): Result<StoredPlaylistItem, TransferItemFailure> {
  const { actor, source, itemId, item, mode } = input;
  if (!item) return err(playlistItemNotFound(source.id, itemId));
  if (mode === 'copy') return ok(item);
  return andThen(
    decidePlaylistAction({ actor, playlist: source, playlistId: source.id }, 'removeItem', item),
    () => ok(item)
  );
}

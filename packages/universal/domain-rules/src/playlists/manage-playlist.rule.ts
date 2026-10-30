import type { Playlist, PlaylistPatch } from '@vp/domain';
import {
  type UserContext,
  canDeletePlaylist,
  canManagePlaylistItems,
  canReadPlaylist,
  canUpdatePlaylist,
} from '@vp/permissions';
import { type Result, andThen, err, map, ok } from '@vp/result';
import { type InvalidPlaylistDetails, validatePlaylistDetails } from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type PlaylistNotFound,
  type SystemPlaylistImmutable,
  playlistNotFound,
  systemPlaylistImmutable,
} from './failures';

export interface ManagePlaylistInput {
  readonly actor: UserContext | null;
  readonly playlist: Playlist | null;
  readonly playlistId: string;
}

export interface UpdatePlaylistInput extends ManagePlaylistInput {
  readonly patch: PlaylistPatch;
}

export type ManagePlaylistFailure = PlaylistNotFound | AuthorizationFailure;
export type DeletePlaylistFailure = ManagePlaylistFailure | SystemPlaylistImmutable;
export type UpdatePlaylistFailure = DeletePlaylistFailure | InvalidPlaylistDetails;

type Check = (check: { user: UserContext | null; playlist: Playlist }) => boolean;

/**
 * A playlist the actor cannot read is absent to them, so a private id never confirms it exists.
 * One they can read but not edit is a 403 they can understand.
 */
function permitted(
  input: ManagePlaylistInput,
  allowed: Check,
  action: 'update' | 'delete'
): Result<Playlist, ManagePlaylistFailure> {
  const { actor, playlist } = input;
  if (!(playlist && canReadPlaylist({ user: actor, playlist }))) {
    return err(playlistNotFound(input.playlistId));
  }
  return map(
    authorize(actor, allowed({ user: actor, playlist }), { action, subject: 'Playlist' }),
    () => playlist
  );
}

function userEditable(playlist: Playlist): Result<Playlist, SystemPlaylistImmutable> {
  return playlist.isSystem ? err(systemPlaylistImmutable(playlist.id)) : ok(playlist);
}

export function decidePlaylistUpdate(
  input: UpdatePlaylistInput
): Result<PlaylistPatch, UpdatePlaylistFailure> {
  const { visibility } = input.patch;
  return andThen(permitted(input, canUpdatePlaylist, 'update'), (playlist) =>
    andThen(userEditable(playlist), () =>
      map(validatePlaylistDetails(input.patch), (details) => ({
        ...details,
        ...(visibility === undefined ? {} : { visibility }),
      }))
    )
  );
}

export function decidePlaylistDelete(
  input: ManagePlaylistInput
): Result<Playlist, DeletePlaylistFailure> {
  return andThen(permitted(input, canDeletePlaylist, 'delete'), userEditable);
}

/** Watch Later takes items like any playlist; only its identity is fixed. */
export function decidePlaylistItemsChange(
  input: ManagePlaylistInput
): Result<Playlist, ManagePlaylistFailure> {
  return permitted(input, canManagePlaylistItems, 'update');
}

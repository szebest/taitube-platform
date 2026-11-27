import { type Result, err, ok } from '@kit/result';
import type { SeatedPlaylist } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import {
  type PlaylistCollaboratorNotFound,
  type PlaylistNotFound,
  playlistCollaboratorNotFound,
  playlistNotFound,
} from './failures';

export interface LeavePlaylistInput {
  readonly actor: UserContext;
  readonly playlist: SeatedPlaylist | null;
  readonly playlistId: string;
}

/** Anyone seated may leave; the owner holds no seat, so the owner cannot. */
export function decidePlaylistLeave(
  input: LeavePlaylistInput
): Result<SeatedPlaylist, PlaylistNotFound | PlaylistCollaboratorNotFound> {
  const { actor, playlist, playlistId } = input;
  if (!playlist) return err(playlistNotFound(playlistId));
  return playlist.collaboratorRole === null
    ? err(playlistCollaboratorNotFound(playlistId, actor.id))
    : ok(playlist);
}

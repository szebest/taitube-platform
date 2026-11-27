import { type Result, err, ok } from '@kit/result';
import {
  MAX_PLAYLIST_COLLABORATORS,
  type PlaylistCollaboratorRole,
  type PlaylistInvite,
  playlistInviteState,
} from '@vp/domain';
import { type UserContext, canAcceptPlaylistInvite } from '@vp/permissions';
import {
  type PlaylistCollaboratorExists,
  type PlaylistCollaboratorLimit,
  type PlaylistInviteInvalid,
  playlistCollaboratorExists,
  playlistCollaboratorLimit,
  playlistInviteInvalid,
} from './failures';

export interface AcceptPlaylistInviteInput {
  readonly user: UserContext;
  /** With the owner of its playlist. */
  readonly invite: (PlaylistInvite & { readonly ownerId: string }) | null;
  readonly isCollaborator: boolean;
  readonly seated: number;
  readonly now: Date;
}

export type AcceptPlaylistInviteFailure =
  | PlaylistInviteInvalid
  | PlaylistCollaboratorExists
  | PlaylistCollaboratorLimit;

/**
 * Taken inside the accepting transaction, against the invite and the seats as they stand under its
 * lock, so two people racing for the last use or the last seat cannot both get it.
 */
export function decidePlaylistInviteAccept(
  input: AcceptPlaylistInviteInput
): Result<{ playlistId: string; role: PlaylistCollaboratorRole }, AcceptPlaylistInviteFailure> {
  const { user, invite, isCollaborator, seated, now } = input;
  if (
    !invite ||
    playlistInviteState(invite, now) !== 'active' ||
    !canAcceptPlaylistInvite({ user, invite })
  ) {
    return err(playlistInviteInvalid());
  }
  if (isCollaborator || user.id === invite.ownerId) {
    return err(playlistCollaboratorExists(invite.playlistId, user.id));
  }
  if (seated >= MAX_PLAYLIST_COLLABORATORS) return err(playlistCollaboratorLimit(invite.playlistId));
  return ok({ playlistId: invite.playlistId, role: invite.role });
}

import { type Result, andThen, err, ok } from '@kit/result';
import {
  MAX_PLAYLIST_COLLABORATORS,
  PLAYLIST_INVITE_DEFAULT_DAYS,
  type PlaylistCollaboratorRole,
  type PlaylistInvite,
  playlistInviteExpiresAt,
} from '@vp/domain';
import { type ChannelNotFound, channelNotFound } from '../channels/failures';
import {
  type PlaylistCollaboratorExists,
  type PlaylistCollaboratorLimit,
  playlistCollaboratorExists,
  playlistCollaboratorLimit,
} from './failures';
import {
  type DeletePlaylistFailure,
  type ManagePlaylistInput,
  decidePlaylistAction,
  userEditable,
} from './manage-playlist.rule';

interface NewInviteFields {
  readonly role: PlaylistCollaboratorRole;
  readonly id: string;
  readonly token: string;
  readonly now: Date;
  /** Collaborators the playlist holds now. */
  readonly seated: number;
}

export interface PersonalInviteInput extends ManagePlaylistInput, NewInviteFields {
  readonly handle: string;
  /** The account behind `handle`; `null` when no channel has it. */
  readonly invitee: { readonly userId: string } | null;
  readonly isCollaborator: boolean;
}

export interface LinkInviteInput extends ManagePlaylistInput, NewInviteFields {
  readonly expiresInDays: number | undefined;
  readonly maxUses: number | null;
}

export type PersonalInviteFailure =
  | DeletePlaylistFailure
  | ChannelNotFound
  | PlaylistCollaboratorExists
  | PlaylistCollaboratorLimit;

export type LinkInviteFailure = DeletePlaylistFailure | PlaylistCollaboratorLimit;

function invite(
  playlistId: string,
  fields: NewInviteFields,
  createdBy: string | null,
  rest: Pick<PlaylistInvite, 'inviteeUserId' | 'expiresAt' | 'maxUses'>
): PlaylistInvite {
  const { id, role, token, now } = fields;
  return {
    id,
    playlistId,
    role,
    token,
    createdBy,
    useCount: 0,
    revokedAt: null,
    createdAt: now,
    ...rest,
  };
}

/** The owner is on the playlist already, so inviting them is inviting a collaborator. */
export function decidePlaylistInvite(
  input: PersonalInviteInput
): Result<PlaylistInvite, PersonalInviteFailure> {
  return andThen(
    andThen(decidePlaylistAction(input, 'manageCollaborators'), userEditable),
    (playlist): Result<PlaylistInvite, PersonalInviteFailure> => {
      const { invitee, handle, isCollaborator, seated, now } = input;
      if (!invitee) return err(channelNotFound(handle));
      if (isCollaborator || invitee.userId === playlist.ownerId) {
        return err(playlistCollaboratorExists(playlist.id, invitee.userId));
      }
      if (seated >= MAX_PLAYLIST_COLLABORATORS) return err(playlistCollaboratorLimit(playlist.id));
      return ok(
        invite(playlist.id, input, input.actor?.id ?? null, {
          inviteeUserId: invitee.userId,
          expiresAt: playlistInviteExpiresAt(PLAYLIST_INVITE_DEFAULT_DAYS, now),
          maxUses: 1,
        })
      );
    }
  );
}

export function decidePlaylistLinkInvite(
  input: LinkInviteInput
): Result<PlaylistInvite, LinkInviteFailure> {
  return andThen(
    andThen(decidePlaylistAction(input, 'manageCollaborators'), userEditable),
    (playlist): Result<PlaylistInvite, LinkInviteFailure> => {
      if (input.seated >= MAX_PLAYLIST_COLLABORATORS) {
        return err(playlistCollaboratorLimit(playlist.id));
      }
      return ok(
        invite(playlist.id, input, input.actor?.id ?? null, {
          inviteeUserId: null,
          expiresAt: playlistInviteExpiresAt(
            input.expiresInDays ?? PLAYLIST_INVITE_DEFAULT_DAYS,
            input.now
          ),
          maxUses: input.maxUses,
        })
      );
    }
  );
}

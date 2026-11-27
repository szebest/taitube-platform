import { type Result, andThen, err, map, ok } from '@kit/result';
import { PLAYLIST_PIN_LIMIT, type SeatedPlaylist } from '@vp/domain';
import {
  canCreatePlaylist,
  canFollowPlaylist,
  canPinPlaylist,
  canReadPlaylistStats,
  canUpdatePlaylist,
} from '@vp/permissions';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type PlaylistNotFound,
  type PlaylistNotSmart,
  type PlaylistPinLimit,
  type SystemPlaylistImmutable,
  playlistNotSmart,
  playlistPinLimit,
} from './failures';
import { type ManagePlaylistInput, decidePlaylistRead, userEditable } from './manage-playlist.rule';

type Refused = PlaylistNotFound | AuthorizationFailure;

/** The owner pins up to `PLAYLIST_PIN_LIMIT` lists; pinning a pinned one counts nothing new. */
export function decidePlaylistPin(
  input: ManagePlaylistInput,
  pinned: number
): Result<SeatedPlaylist, Refused | PlaylistPinLimit> {
  return andThen(decidePlaylistRead(input), (playlist) =>
    andThen(
      authorize(input.actor, canPinPlaylist({ user: input.actor, playlist }), {
        action: 'pin',
        subject: 'Playlist',
      }),
      () =>
        playlist.pinnedAt === null && pinned >= PLAYLIST_PIN_LIMIT
          ? err(playlistPinLimit(playlist.id))
          : ok(playlist)
    )
  );
}

export function decidePlaylistUnpin(input: ManagePlaylistInput): Result<SeatedPlaylist, Refused> {
  return andThen(decidePlaylistRead(input), (playlist) =>
    map(
      authorize(input.actor, canPinPlaylist({ user: input.actor, playlist }), {
        action: 'pin',
        subject: 'Playlist',
      }),
      () => playlist
    )
  );
}

/** A playlist the caller can read and does not own. */
export function decidePlaylistFollow(input: ManagePlaylistInput): Result<SeatedPlaylist, Refused> {
  return andThen(decidePlaylistRead(input), (playlist) =>
    map(
      authorize(input.actor, canFollowPlaylist({ user: input.actor, playlist }), {
        action: 'subscribe',
        subject: 'Playlist',
      }),
      () => playlist
    )
  );
}

/** Copying a playlist the caller can read into one of their own. */
export function decidePlaylistFork(input: ManagePlaylistInput): Result<SeatedPlaylist, Refused> {
  return andThen(decidePlaylistRead(input), (playlist) =>
    map(
      authorize(input.actor, canCreatePlaylist({ user: input.actor }), {
        action: 'create',
        subject: 'Playlist',
      }),
      () => playlist
    )
  );
}

/** A fork of a smart playlist that writes what it computes now rather than its rules. */
export function decidePlaylistFreeze(
  input: ManagePlaylistInput
): Result<SeatedPlaylist, Refused | PlaylistNotSmart> {
  return andThen(decidePlaylistFork(input), (playlist) =>
    playlist.rules === null ? err(playlistNotSmart(playlist.id)) : ok(playlist)
  );
}

/** A reader who is not the owner learns the stats exist and may not see them. */
export function decidePlaylistStatsRead(
  input: ManagePlaylistInput
): Result<SeatedPlaylist, Refused> {
  return andThen(decidePlaylistRead(input), (playlist) =>
    map(
      authorize(
        input.actor,
        canReadPlaylistStats({ user: input.actor, stats: { ownerId: playlist.ownerId } }),
        { action: 'read', subject: 'PlaylistStats' }
      ),
      () => playlist
    )
  );
}

/** A share link changes who may read, so it is the visibility's owner's; Watch Later is never shared. */
export function decidePlaylistShare(
  input: ManagePlaylistInput
): Result<SeatedPlaylist, Refused | SystemPlaylistImmutable> {
  return andThen(decidePlaylistRead(input), (playlist) =>
    andThen(
      authorize(
        input.actor,
        canUpdatePlaylist({ user: input.actor, playlist, field: 'visibility' }),
        { action: 'update', subject: 'Playlist' }
      ),
      () => userEditable(playlist)
    )
  );
}

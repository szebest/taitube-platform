import { type Result, andThen, err, map, ok } from '@kit/result';
import type { SeatedPlaylist } from '@vp/domain';
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
  type SystemPlaylistImmutable,
  playlistNotSmart,
} from './failures';
import { type ManagePlaylistInput, decidePlaylistRead, userEditable } from './manage-playlist.rule';

type Refused = PlaylistNotFound | AuthorizationFailure;

/** The owner's own list, to pin or unpin; the pin limit is held where the pin is written, under a lock on the owner. */
export function decidePlaylistPin(input: ManagePlaylistInput): Result<SeatedPlaylist, Refused> {
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

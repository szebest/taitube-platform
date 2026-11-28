import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type { ChannelCard, Playlist, PlaylistVisibility } from '@vp/domain';
import type { UserContext } from '@vp/permissions';

export type FollowOutcome = 'followed' | 'present' | 'playlist-missing';

/** `full` when the owner holds `PLAYLIST_PIN_LIMIT` pins already; repinning a pinned one is `pinned`. */
export type PinOutcome = 'pinned' | 'full' | 'missing';

/** A followed playlist as the follower may read it now; `playlist` is null once they cannot. */
export interface FollowedPlaylist {
  playlistId: string;
  followedAt: Date;
  playlist: {
    title: string;
    visibility: PlaylistVisibility;
    isSmart: boolean;
    customThumbnailKey: string | null;
    posterKey: string | null;
    videoCount: number;
    owner: ChannelCard | null;
    updatedAt: Date;
  } | null;
}

export interface ListFollowedOptions {
  cursor: { followedAt: Date; playlistId: string } | null;
  limit: number;
}

/** A new playlist of the caller's, made from another: its id, owner and title. */
export interface PlaylistCopy {
  id: string;
  ownerId: string;
  title: string;
}

/**
 * What a user keeps of playlists beside their own items: pins, follows, forks and frozen copies. A
 * copy is written with its items in one transaction, so a half-made playlist is never seen.
 */
export interface PlaylistLibraryRepositoryPort {
  /** Counts the owner's pins and pins under one lock on the owner, so parallel pins never pass the limit. */
  pin(
    ownerId: string,
    playlistId: string,
    at: Date
  ): Promise<Result<PinOutcome, DatabaseUnavailable>>;
  /** False when the playlist is gone. */
  unpin(playlistId: string): Promise<Result<boolean, DatabaseUnavailable>>;
  follow(userId: string, playlistId: string): Promise<Result<FollowOutcome, DatabaseUnavailable>>;
  unfollow(userId: string, playlistId: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Newest follow first, up to `limit + 1`, each read through the viewer's read scope. */
  listFollowed(
    viewer: UserContext,
    options: ListFollowedOptions
  ): Promise<Result<FollowedPlaylist[], DatabaseUnavailable>>;
  /**
   * A private copy of `sourceId` crediting it: its rules, and every row with its note, segment and
   * section, in order, the caller as their adder. `null` when the source is gone.
   */
  fork(sourceId: string, copy: PlaylistCopy): Promise<Result<Playlist | null, DatabaseUnavailable>>;
  /** A normal private playlist holding `videoIds` in that order, the caller as their adder. */
  freeze(
    copy: PlaylistCopy & { description: string },
    videoIds: readonly string[]
  ): Promise<Result<Playlist, DatabaseUnavailable>>;
}

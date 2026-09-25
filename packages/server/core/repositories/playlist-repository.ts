import type {
  NewPlaylistInput,
  OwnedPlaylist,
  Playlist,
  PlaylistDetail,
  PlaylistPatch,
  PositionWrite,
  PositionedItem,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { Result } from '@vp/result';

export type AddPlaylistItemOutcome = 'added' | 'present' | 'playlist-missing' | 'video-missing';

export interface NewPlaylistItem {
  id: string;
  videoId: string;
}

/** Decides the position writes from the items as they stand inside the write transaction. */
export type ReorderPlan<F> = (items: readonly PositionedItem[]) => Result<PositionWrite[], F>;

/**
 * `findById` is unscoped, for write decisions; every read a caller sees goes through the viewer's
 * read scope, so a private playlist and a video the viewer may not watch never reach them.
 * Item writes lock the playlist row, so concurrent appends and reorders serialise.
 */
export interface PlaylistRepositoryPort {
  create(input: NewPlaylistInput): Promise<Result<Playlist, DatabaseUnavailable>>;
  /** Idempotent: an owner who already has their Watch Later keeps it. */
  provisionWatchLater(input: {
    id: string;
    ownerId: string;
  }): Promise<Result<void, DatabaseUnavailable>>;
  findById(id: string): Promise<Result<Playlist | null, DatabaseUnavailable>>;
  findDetail(
    id: string,
    viewer: UserContext | null
  ): Promise<Result<PlaylistDetail | null, DatabaseUnavailable>>;
  /** Watch Later first, then the most recently changed. */
  listOwned(
    owner: UserContext,
    videoId: string | null
  ): Promise<Result<OwnedPlaylist[], DatabaseUnavailable>>;
  update(id: string, patch: PlaylistPatch): Promise<Result<Playlist | null, DatabaseUnavailable>>;
  /** Never removes a system playlist; answers whether a row went. */
  remove(id: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Appends after the last item; adding a video the playlist holds is `present`, not an error. */
  addItem(
    playlistId: string,
    item: NewPlaylistItem
  ): Promise<Result<AddPlaylistItemOutcome, DatabaseUnavailable>>;
  removeItem(playlistId: string, videoId: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Answers false, and writes nothing, when the playlist is gone. */
  reorder<F>(
    playlistId: string,
    plan: ReorderPlan<F>
  ): Promise<Result<boolean, DatabaseUnavailable | F>>;
}

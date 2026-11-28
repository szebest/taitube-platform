import type { Result } from '@kit/result';
import type { PlaylistActivity } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export interface ListPlaylistActivityOptions {
  cursor: { createdAt: Date; id: string } | null;
  limit: number;
}

/** The log the playlist writes keep; it is read here, written only by those writes. */
export interface PlaylistActivityRepositoryPort {
  /** Newest first, up to `limit + 1`. */
  list(
    playlistId: string,
    options: ListPlaylistActivityOptions
  ): Promise<Result<PlaylistActivity[], DatabaseUnavailable>>;
  find(id: string): Promise<Result<PlaylistActivity | null, DatabaseUnavailable>>;
  purgeOlderThan(before: Date): Promise<Result<number, DatabaseUnavailable>>;
}

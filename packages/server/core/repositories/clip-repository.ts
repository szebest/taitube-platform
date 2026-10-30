import type { Clip, ClipEntry } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { Result } from '@vp/result';

interface ClipCursor {
  createdAt: Date;
  id: string;
}

export interface ListClipsOptions {
  cursor: ClipCursor | null;
  limit: number;
}

/** A clip is a reference to a range of a video: no media is stored, so a delete touches one row. */
export interface ClipRepositoryPort {
  create(clip: Clip): Promise<Result<void, DatabaseUnavailable>>;
  findById(id: string): Promise<Result<Clip | null, DatabaseUnavailable>>;
  /**
   * The viewer's own clips, newest first, only those of a video they may still watch, up to
   * `limit + 1` rows. A creator's clips are private to them: there is no read of another user's.
   */
  listByCreator(
    viewer: UserContext,
    options: ListClipsOptions
  ): Promise<Result<ClipEntry[], DatabaseUnavailable>>;
  remove(id: string): Promise<Result<boolean, DatabaseUnavailable>>;
}

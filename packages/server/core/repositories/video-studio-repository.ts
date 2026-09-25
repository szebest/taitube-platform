import type {
  CreatorLibraryCursor,
  CreatorLibrarySort,
  VideoStatus,
  VideoVisibility,
} from '@vp/domain';
import type { DatabaseUnavailable, VersionConflict } from '@vp/errors';
import type { Result } from '@vp/result';
import type { VideoRecord } from './video-repository';

export interface StudioMetadataPatch {
  title?: string;
  description?: string;
  visibility?: VideoVisibility;
  categoryId?: string | null;
  tags?: string[];
  customThumbnailKey?: string | null;
}

export interface UpdateStudioMetadataOptions {
  videoId: string;
  expectedVersion: number;
  patch: StudioMetadataPatch;
  userId: string;
}

/** Absence is an answer, not a failure: the service decides which error each one becomes. */
export type StudioMetadataOutcome =
  | { type: 'updated'; video: VideoRecord }
  | { type: 'video-missing' }
  | { type: 'category-missing'; categoryId: string };

export interface CreatorLibraryQuery {
  ownerId: string;
  sort: CreatorLibrarySort;
  cursor?: CreatorLibraryCursor | null;
  limit: number;
  status?: VideoStatus;
  visibility?: VideoVisibility;
}

export interface TakeDownVideoOptions {
  videoId: string;
  from: readonly VideoStatus[];
  moderatorId: string;
  reason?: string;
}

/**
 * What a creator does to their own library and a moderator does to anyone's. Every write bumps
 * `version`, so an edit read before a takedown cannot land after it and undo it.
 */
export abstract class VideoStudioRepository {
  /** A deleted video is never listed; `limit + 1` rows, ordered by the sort, then id, descending. */
  abstract listLibrary(
    query: CreatorLibraryQuery
  ): Promise<Result<VideoRecord[], DatabaseUnavailable>>;
  /** A category is assignable while it exists and is active, checked in the write's transaction. */
  abstract updateMetadata(
    options: UpdateStudioMetadataOptions
  ): Promise<Result<StudioMetadataOutcome, DatabaseUnavailable | VersionConflict>>;
  /** `REJECTED` and `private` together, with a `video.taken_down` event; `ok(null)` if `from` missed. */
  abstract takeDown(
    options: TakeDownVideoOptions
  ): Promise<Result<VideoRecord | null, DatabaseUnavailable>>;
}

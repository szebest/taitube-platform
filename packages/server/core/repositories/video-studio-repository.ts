import type { Result } from '@kit/result';
import type {
  CreatorLibraryCursor,
  LibrarySort,
  SortOrder,
  VideoAuditField,
  VideoStatus,
  VideoVisibility,
} from '@vp/domain';
import type { DatabaseUnavailable, VersionConflict } from '@vp/errors';
import type { VideoRecord } from './video-repository';

export interface StudioMetadataPatch {
  title?: string;
  description?: string;
  visibility?: VideoVisibility;
  categoryId?: string | null;
  tags?: string[];
  customThumbnailKey?: string | null;
  commentsEnabled?: boolean;
}

export interface UpdateStudioMetadataOptions {
  videoId: string;
  expectedVersion: number;
  patch: StudioMetadataPatch;
  userId: string;
  /** The personal access token the edit was made with, named in the audit entries beside `userId`. */
  tokenId?: string;
  /**
   * Audited as `video.updated` by `userId` on the channel of the video owner, in the edit transaction,
   * unless empty; a `commentsEnabled` in the patch is audited on its own as `video.comments.toggled`.
   */
  auditFields: VideoAuditField[];
}

/** Absence is an answer, not a failure: the service decides which error each one becomes. */
export type StudioMetadataOutcome =
  | { type: 'updated'; video: VideoRecord }
  | { type: 'video-missing' }
  | { type: 'category-missing'; categoryId: string };

export interface VideoLibraryQuery {
  /** Absent for an operator, who lists everyone's videos. */
  ownerId?: string;
  sort: LibrarySort;
  /** Defaults to `desc`; the cursor must have been minted for the same sort and order. */
  order?: SortOrder;
  cursor?: CreatorLibraryCursor | null;
  limit: number;
  status?: VideoStatus;
  visibility?: VideoVisibility;
  categoryId?: string;
  /** Case-insensitive substring of the title. */
  titleContains?: string;
}

export interface TakeDownVideoOptions {
  videoId: string;
  moderatorId: string;
  reason?: string;
}

/**
 * What a creator does to their own library and a moderator does to anyone's. Every write bumps
 * `version`, so an edit read before a takedown cannot land after it and undo it.
 */
export abstract class VideoStudioRepository {
  /** A deleted video is never listed; `limit + 1` rows, ordered by the sort, then id, in the query's order. */
  abstract listLibrary(
    query: VideoLibraryQuery
  ): Promise<Result<VideoRecord[], DatabaseUnavailable>>;
  /** A category is assignable while it exists and is active, checked in the write's transaction. */
  abstract updateMetadata(
    options: UpdateStudioMetadataOptions
  ): Promise<Result<StudioMetadataOutcome, DatabaseUnavailable | VersionConflict>>;
  /**
   * The lifecycle's `takedown` edge, `private` with it, announced to the owner like any other status
   * change; `ok(null)` when the video was in none of its sources.
   */
  abstract takeDown(
    options: TakeDownVideoOptions
  ): Promise<Result<VideoRecord | null, DatabaseUnavailable>>;
}

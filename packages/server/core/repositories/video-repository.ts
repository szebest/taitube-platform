import type {
  PublicFeedCursor,
  PublicFeedSort,
  Video,
  VideoStatus,
  VideoVisibility,
} from '@vp/domain';
import type { DatabaseUnavailable, VersionConflict } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { Result } from '@vp/result';

import type { VideoEventRecord } from './event-repository';
import type { NewOutboxInput } from './outbox-repository';
import type { RenditionRecord } from './rendition-repository';
import type { ProcessingStepRecord } from './step-repository';
import type { UploadRecord } from './upload-repository';

export type VideoRecord = Video;

export interface NewVideoInput {
  id: string;
  ownerId: string;
  title?: string | null;
  description?: string | null;
  visibility?: VideoVisibility;
  status?: VideoStatus;
  sourceKey: string;
  sourceSizeBytes?: number | null;
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  ladder?: unknown;
  masterPlaylistKey?: string | null;
  posterKey?: string | null;
  spriteKey?: string | null;
  playbackUrl?: string | null;
  posterUrl?: string | null;
  spriteUrl?: string | null;
  spriteVttUrl?: string | null;
  viewsCount?: number;
  likesCount?: number;
  dislikesCount?: number;
  categoryId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  generation?: number;
  readyAt?: Date | null;
  deletedAt?: Date | null;
}

export interface UpdateVideoMetadataOptions {
  videoId: string;
  expectedVersion: number;
  patch: {
    title?: string;
    description?: string;
    visibility?: VideoVisibility;
  };
  userId?: string;
}

export interface ListVideosOptions {
  ownerId: string;
  viewer?: UserContext | null;
  cursor?: {
    createdAt: Date;
    id: string;
  } | null;
  limit: number;
  status?: VideoStatus;
}

export interface ListPublicVideosOptions {
  cursor?: PublicFeedCursor | null;
  limit: number;
  sort?: PublicFeedSort;
  categoryId?: string | null;
}

export interface ListPublicVideosResult {
  items: VideoRecord[];
  total: number;
  /** The instant every row on this page was ranked against; the next cursor carries it on. */
  instant: number;
}

export interface TransitionVideoOptions {
  videoId: string;
  from: VideoStatus | VideoStatus[];
  to: VideoStatus;
  eventType: string;
  eventPayload?: Record<string, unknown>;
  traceId?: string | null;
  patch?: Partial<
    Omit<VideoRecord, 'id' | 'ownerId' | 'status' | 'createdAt' | 'updatedAt' | 'version'>
  >;
  outbox?: NewOutboxInput;
}

export type VideoIdleClock = 'updatedAt' | 'deletedAt' | 'readyAt';

export type VideoScanAbsence =
  | { type: 'step'; step: string }
  | { type: 'event'; event: string; forCurrentGeneration?: boolean };

export interface VideoScan {
  status: VideoStatus;
  idleFor?: { since: VideoIdleClock; ms: number };
  minGeneration?: number;
  without?: VideoScanAbsence;
  limit?: number;
}

export const DEFAULT_VIDEO_SCAN_LIMIT = 100;

export interface VideoWithDetails {
  video: VideoRecord;
  renditions: RenditionRecord[];
  steps: ProcessingStepRecord[];
  events: VideoEventRecord[];
  upload?: UploadRecord | null;
}

/**
 * Absence is not a failure: `findById`, `findWithDetails` and `updateMetadata` answer `ok(null)` for
 * a row that is not there, and the rule that asked decides whether that is an error.
 */
export abstract class VideoRepository {
  abstract findById(id: string): Promise<Result<VideoRecord | null, DatabaseUnavailable>>;
  abstract findWithDetails(
    id: string
  ): Promise<Result<VideoWithDetails | null, DatabaseUnavailable>>;
  abstract create(data: NewVideoInput): Promise<Result<VideoRecord, DatabaseUnavailable>>;
  abstract listByOwner(
    options: ListVideosOptions
  ): Promise<Result<VideoRecord[], DatabaseUnavailable>>;
  abstract listPublic(
    options: ListPublicVideosOptions
  ): Promise<Result<ListPublicVideosResult, DatabaseUnavailable>>;
  abstract updateMetadata(
    options: UpdateVideoMetadataOptions
  ): Promise<Result<VideoRecord | null, DatabaseUnavailable | VersionConflict>>;
  abstract transition(
    options: TransitionVideoOptions
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  /**
   * Housekeeping sweep. `idleFor` measures from `COALESCE(since, updatedAt)`, and a row a
   * concurrent scan already holds is skipped, so two housekeeping runs never pick the same one.
   */
  abstract scan(filter: VideoScan): Promise<Result<VideoRecord[], DatabaseUnavailable>>;
  abstract hardDelete(id: string): Promise<Result<boolean, DatabaseUnavailable>>;
  abstract countByStatus(): Promise<Result<Record<string, number>, DatabaseUnavailable>>;
  abstract countInFlightByOwner(ownerId: string): Promise<Result<number, DatabaseUnavailable>>;
  abstract updateReactionCounters(
    videoId: string,
    likesCount: number,
    dislikesCount: number
  ): Promise<Result<void, DatabaseUnavailable>>;
}

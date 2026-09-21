import type { PublicFeedCursor, PublicFeedSort } from '@vp/domain';
import type { UserContext } from '@vp/permissions';

import type { VideoEventRecord } from './event-repository';
import type { NewOutboxInput } from './outbox-repository';
import type { RenditionRecord } from './rendition-repository';
import type { ProcessingStepRecord } from './step-repository';
import type { UploadRecord } from './upload-repository';

export type VideoStatus =
  | 'UPLOADING'
  | 'UPLOADED'
  | 'PROBING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'REJECTED'
  | 'ABANDONED'
  | 'DELETED';

export type VideoVisibility = 'private' | 'unlisted' | 'public';

export interface VideoRecord {
  id: string;
  ownerId: string;
  title: string | null;
  description: string | null;
  visibility: VideoVisibility;
  status: VideoStatus;
  sourceKey: string;
  sourceSizeBytes: number | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  fps?: number | null;
  ladder: unknown;
  masterPlaylistKey?: string | null;
  posterKey?: string | null;
  spriteKey?: string | null;
  playbackUrl?: string | null;
  posterUrl?: string | null;
  spriteUrl?: string | null;
  spriteVttUrl?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  viewsCount?: number;
  likesCount?: number;
  dislikesCount?: number;
  categoryId?: string | null;
  generation: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  readyAt: Date | null;
  deletedAt?: Date | null;
}

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
  | { step: string }
  | { event: string; forCurrentGeneration?: boolean };

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

export abstract class VideoRepository {
  abstract findById(id: string): Promise<VideoRecord | null>;
  abstract findWithDetails(id: string): Promise<VideoWithDetails | null>;
  abstract create(data: NewVideoInput): Promise<VideoRecord>;
  abstract listByOwner(options: ListVideosOptions): Promise<VideoRecord[]>;
  abstract listPublic(options: ListPublicVideosOptions): Promise<ListPublicVideosResult>;
  abstract updateMetadata(options: UpdateVideoMetadataOptions): Promise<VideoRecord>;
  abstract transition(options: TransitionVideoOptions): Promise<boolean>;
  /**
   * Housekeeping sweep. `idleFor` measures from `COALESCE(since, updatedAt)`, and a row a
   * concurrent scan already holds is skipped, so two housekeeping runs never pick the same one.
   */
  abstract scan(filter: VideoScan): Promise<VideoRecord[]>;
  abstract hardDelete(id: string): Promise<boolean>;
  abstract countByStatus(): Promise<Record<string, number>>;
  abstract countInFlightByOwner(ownerId: string): Promise<number>;
  abstract updateReactionCounters(
    videoId: string,
    likesCount: number,
    dislikesCount: number
  ): Promise<void>;
}

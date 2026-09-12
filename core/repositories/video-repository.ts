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
    title?: string | null;
    description?: string | null;
    visibility?: VideoVisibility;
  };
  userId?: string;
}

export interface ListVideosOptions {
  ownerId: string;
  cursor?: {
    createdAt: Date;
    id: string;
  } | null;
  limit: number;
  status?: VideoStatus;
}

import type { VideoEventRecord } from './event-repository';
import type { NewOutboxInput } from './outbox-repository';
import type { RenditionRecord } from './rendition-repository';
import type { ProcessingStepRecord } from './step-repository';
import type { UploadRecord } from './upload-repository';

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
  abstract updateMetadata(options: UpdateVideoMetadataOptions): Promise<VideoRecord>;
  abstract transition(options: TransitionVideoOptions): Promise<boolean>;
  abstract findStaleUploading(thresholdMs: number, limit?: number): Promise<VideoRecord[]>;
  abstract findStaleUploadedWithoutProbe(
    thresholdMs: number,
    limit?: number
  ): Promise<VideoRecord[]>;
  abstract findStaleProcessing(thresholdMs: number, limit?: number): Promise<VideoRecord[]>;
  abstract findSoftDeleted(thresholdMs: number, limit?: number): Promise<VideoRecord[]>;
  abstract findExpiredRaw(retentionDays: number, limit?: number): Promise<VideoRecord[]>;
  abstract findReadyWithOldGenerations(limit?: number): Promise<VideoRecord[]>;
  abstract hardDelete(id: string): Promise<boolean>;
  abstract countByStatus(): Promise<Record<string, number>>;
  abstract countInFlightByOwner(ownerId: string): Promise<number>;
}

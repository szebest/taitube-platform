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
}

export interface UpdateVideoMetadataOptions {
  videoId: string;
  expectedVersion: number;
  patch: {
    title?: string | null;
    description?: string | null;
    visibility?: VideoVisibility;
  };
}

export interface TransitionVideoOptions {
  videoId: string;
  from: VideoStatus | VideoStatus[];
  to: VideoStatus;
  eventType: string;
  eventPayload?: Record<string, unknown>;
  patch?: Partial<
    Omit<VideoRecord, 'id' | 'ownerId' | 'status' | 'createdAt' | 'updatedAt' | 'version'>
  >;
}
import type { VideoEventRecord } from './event-repository.js';
import type { RenditionRecord } from './rendition-repository.js';
import type { ProcessingStepRecord } from './step-repository.js';
import type { UploadRecord } from './upload-repository.js';

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
  abstract updateMetadata(options: UpdateVideoMetadataOptions): Promise<VideoRecord>;
  abstract transition(options: TransitionVideoOptions): Promise<boolean>;
}

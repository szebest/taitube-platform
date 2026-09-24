import type { StepStatus } from '@vp/domain';

import type {
  EventRepository,
  OutboxRepository,
  RenditionRepository,
  StepRepository,
  UploadRepository,
  VideoRecord,
} from '@vp/core/repositories';

export interface InternalStep {
  id: string;
  videoId: string;
  step: string;
  rendition: string;
  jobId: string;
  attempt: number;
  status: StepStatus;
  workerId: string | null;
  lockToken: string | null;
  startedAt: Date | null;
  heartbeatAt: Date | null;
  finishedAt: Date | null;
  completedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  result: unknown;
  createdAt: Date;
}

export interface InMemoryVideoRepositoryOptions {
  eventsRepo?: EventRepository;
  renditionsRepo?: RenditionRepository;
  stepsRepo?: StepRepository;
  uploadsRepo?: UploadLookup;
  outboxRepo?: OutboxRepository;
}

/** A video's upload is the one thing this repository reads back from uploads. */
export type UploadLookup = Pick<UploadRepository, 'findByVideoId'>;

export const DEFAULT_VIDEO_RECORD: Omit<
  VideoRecord,
  'id' | 'ownerId' | 'sourceKey' | 'createdAt' | 'updatedAt' | 'version'
> = {
  title: null,
  description: null,
  visibility: 'private',
  status: 'UPLOADING',
  sourceSizeBytes: null,
  durationMs: null,
  width: null,
  height: null,
  fps: null,
  ladder: null,
  masterPlaylistKey: null,
  posterKey: null,
  spriteKey: null,
  playbackUrl: null,
  posterUrl: null,
  spriteUrl: null,
  spriteVttUrl: null,
  errorCode: null,
  errorMessage: null,
  viewsCount: 0,
  categoryId: null,
  generation: 1,
  readyAt: null,
};

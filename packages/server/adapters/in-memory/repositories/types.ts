import type { StepStatus } from '@vp/domain';

import type {
  EventRepository,
  OutboxRepository,
  RenditionRepository,
  StepRepository,
  UploadRepository,
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

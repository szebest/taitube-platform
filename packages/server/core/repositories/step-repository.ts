import type { StepStatus } from '@vp/domain';

export interface ProcessingStepRecord {
  id: string;
  videoId: string;
  step: string;
  rendition: string;
  status: StepStatus;
  jobId: string;
  attempt: number;
  workerId: string | null;
  lockToken: string | null;
  heartbeatAt: Date | null;
  startedAt: Date | null;
  finishedAt?: Date | null;
  completedAt?: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  result: unknown;
  createdAt?: Date;
}

export interface ClaimStepOptions {
  id: string;
  videoId: string;
  step: string;
  rendition: string;
  jobId: string;
  attempt: number;
  workerId: string;
  lockToken: string;
}

export interface ClaimStepResult {
  fenced: boolean;
  stepId: string;
  lockToken: string;
}

export interface CompleteStepOptions {
  videoId: string;
  step: string;
  rendition: string;
  lockToken: string;
  result?: unknown;
}

export interface CompleteStepResult {
  fenced: boolean;
  completed: boolean;
}

export interface FailStepOptions {
  videoId: string;
  step: string;
  rendition: string;
  lockToken: string;
  errorCode: string;
  errorMessage: string;
}

export interface FailStepResult {
  fenced: boolean;
  failed: boolean;
}

export interface MarkDeadOptions {
  videoId: string;
  step: string;
  rendition?: string;
  errorCode?: string;
  errorMessage?: string;
}

export abstract class StepRepository {
  abstract claim(options: ClaimStepOptions): Promise<ClaimStepResult>;
  abstract complete(options: CompleteStepOptions): Promise<CompleteStepResult>;
  abstract fail(options: FailStepOptions): Promise<FailStepResult>;
  abstract markDead(options: MarkDeadOptions): Promise<boolean>;
  abstract heartbeat(lockToken: string): Promise<boolean>;
  abstract findByVideoId(videoId: string): Promise<ProcessingStepRecord[]>;
  abstract countRunningStale(thresholdMs: number): Promise<number>;
}

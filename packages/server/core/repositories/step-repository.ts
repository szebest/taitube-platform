import type { StepStatus } from '@vp/domain';
import type { DatabaseUnavailable, ErrorCode } from '@vp/errors';
import type { Result } from '@vp/result';

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
  errorCode: ErrorCode;
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
  errorCode?: ErrorCode;
  errorMessage?: string;
}

export abstract class StepRepository {
  abstract claim(options: ClaimStepOptions): Promise<Result<ClaimStepResult, DatabaseUnavailable>>;
  abstract complete(
    options: CompleteStepOptions
  ): Promise<Result<CompleteStepResult, DatabaseUnavailable>>;
  abstract fail(options: FailStepOptions): Promise<Result<FailStepResult, DatabaseUnavailable>>;
  abstract markDead(options: MarkDeadOptions): Promise<Result<boolean, DatabaseUnavailable>>;
  abstract heartbeat(lockToken: string): Promise<Result<boolean, DatabaseUnavailable>>;
  abstract findByVideoId(
    videoId: string
  ): Promise<Result<ProcessingStepRecord[], DatabaseUnavailable>>;
  abstract countRunningStale(thresholdMs: number): Promise<Result<number, DatabaseUnavailable>>;
}

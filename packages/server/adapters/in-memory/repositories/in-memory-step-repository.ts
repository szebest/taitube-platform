import {
  type ClaimStepOptions,
  type ClaimStepResult,
  type CompleteStepOptions,
  type CompleteStepResult,
  type FailStepOptions,
  type FailStepResult,
  type MarkDeadOptions,
  type ProcessingStepRecord,
  StepRepository,
} from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';
import type { InternalStep } from './types';

export class InMemoryStepRepository extends StepRepository {
  private readonly stepsMap = new Map<string, InternalStep>();

  private getStepKey(videoId: string, step: string, rendition: string): string {
    return `${videoId}:${step}:${rendition}`;
  }

  async claim(options: ClaimStepOptions): Promise<Result<ClaimStepResult, DatabaseUnavailable>> {
    const { id, videoId, step, rendition = '-', jobId, attempt, workerId, lockToken } = options;
    const key = this.getStepKey(videoId, step, rendition);
    const existing = this.stepsMap.get(key);

    if (existing && existing.status === 'DONE') {
      return ok({ stepId: existing.id, lockToken: '', fenced: true });
    }

    const now = new Date();
    const entry: InternalStep = {
      id,
      videoId,
      step,
      rendition,
      jobId,
      attempt,
      status: 'RUNNING',
      workerId,
      lockToken,
      startedAt: now,
      heartbeatAt: now,
      finishedAt: null,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      result: null,
      createdAt: existing?.createdAt ?? now,
    };
    this.stepsMap.set(key, entry);

    return ok({ stepId: id, lockToken, fenced: false });
  }

  async complete(
    options: CompleteStepOptions
  ): Promise<Result<CompleteStepResult, DatabaseUnavailable>> {
    const { videoId, step, rendition = '-', lockToken, result = {} } = options;
    const key = this.getStepKey(videoId, step, rendition);
    const existing = this.stepsMap.get(key);

    if (!existing || existing.lockToken !== lockToken) {
      return ok({ completed: false, fenced: true });
    }

    existing.status = 'DONE';
    existing.finishedAt = new Date();
    existing.completedAt = new Date();
    existing.result = result;
    return ok({ completed: true, fenced: false });
  }

  async fail(options: FailStepOptions): Promise<Result<FailStepResult, DatabaseUnavailable>> {
    const { videoId, step, rendition = '-', lockToken, errorCode, errorMessage } = options;
    const key = this.getStepKey(videoId, step, rendition);
    const existing = this.stepsMap.get(key);

    if (!existing || existing.lockToken !== lockToken) {
      return ok({ failed: false, fenced: true });
    }

    existing.status = 'FAILED';
    existing.finishedAt = new Date();
    existing.completedAt = new Date();
    existing.errorCode = errorCode;
    existing.errorMessage = errorMessage ?? null;
    return ok({ failed: true, fenced: false });
  }

  async markDead(options: MarkDeadOptions): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, step, rendition = '-', errorCode, errorMessage } = options;
    const key = this.getStepKey(videoId, step, rendition);
    const existing = this.stepsMap.get(key);
    if (!existing) {
      return ok(false);
    }
    existing.status = 'DEAD';
    existing.finishedAt = new Date();
    existing.completedAt = new Date();
    if (errorCode !== undefined) existing.errorCode = errorCode;
    if (errorMessage !== undefined) existing.errorMessage = errorMessage ?? null;
    return ok(true);
  }

  async heartbeat(lockToken: string): Promise<Result<boolean, DatabaseUnavailable>> {
    for (const step of this.stepsMap.values()) {
      if (step.lockToken === lockToken) {
        step.heartbeatAt = new Date();
        return ok(true);
      }
    }
    return ok(false);
  }

  async findByVideoId(
    videoId: string
  ): Promise<Result<ProcessingStepRecord[], DatabaseUnavailable>> {
    const results: ProcessingStepRecord[] = [];
    for (const step of this.stepsMap.values()) {
      if (step.videoId === videoId) {
        results.push({ ...step });
      }
    }
    return ok(results);
  }

  async countRunningStale(thresholdMs: number): Promise<Result<number, DatabaseUnavailable>> {
    const cutoffTime = Date.now() - thresholdMs;
    let count = 0;
    for (const step of this.stepsMap.values()) {
      if (step.status === 'RUNNING') {
        const lastActivity = step.heartbeatAt ?? step.startedAt;
        if (lastActivity && lastActivity.getTime() < cutoffTime) {
          count++;
        }
      }
    }
    return ok(count);
  }

  clear(): void {
    this.stepsMap.clear();
  }
}

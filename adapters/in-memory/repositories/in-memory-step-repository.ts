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
} from '@vp/core/ports';
import type { InternalStep } from './types.js';

export class InMemoryStepRepository extends StepRepository {
  private readonly stepsMap: Map<string, InternalStep>;

  constructor(stepsMap: Map<string, InternalStep> = new Map()) {
    super();
    this.stepsMap = stepsMap;
  }

  private getStepKey(videoId: string, step: string, rendition: string): string {
    return `${videoId}:${step}:${rendition}`;
  }

  async claim(options: ClaimStepOptions): Promise<ClaimStepResult> {
    const { id, videoId, step, rendition = '-', jobId, attempt, workerId, lockToken } = options;
    const key = this.getStepKey(videoId, step, rendition);
    const existing = this.stepsMap.get(key);

    if (existing && existing.status === 'DONE') {
      return { stepId: existing.id, lockToken: '', fenced: true };
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

    return { stepId: id, lockToken, fenced: false };
  }

  async complete(options: CompleteStepOptions): Promise<CompleteStepResult> {
    const { videoId, step, rendition = '-', lockToken, result = {} } = options;
    const key = this.getStepKey(videoId, step, rendition);
    const existing = this.stepsMap.get(key);

    if (!existing || existing.lockToken !== lockToken) {
      return { completed: false, fenced: true };
    }

    existing.status = 'DONE';
    existing.finishedAt = new Date();
    existing.completedAt = new Date();
    existing.result = result;
    return { completed: true, fenced: false };
  }

  async fail(options: FailStepOptions): Promise<FailStepResult> {
    const { videoId, step, rendition = '-', lockToken, errorCode, errorMessage } = options;
    const key = this.getStepKey(videoId, step, rendition);
    const existing = this.stepsMap.get(key);

    if (!existing || existing.lockToken !== lockToken) {
      return { failed: false, fenced: true };
    }

    existing.status = 'FAILED';
    existing.finishedAt = new Date();
    existing.completedAt = new Date();
    existing.errorCode = errorCode;
    existing.errorMessage = errorMessage ?? null;
    return { failed: true, fenced: false };
  }

  async markDead(options: MarkDeadOptions): Promise<boolean> {
    const { videoId, step, rendition = '-', errorCode, errorMessage } = options;
    const key = this.getStepKey(videoId, step, rendition);
    const existing = this.stepsMap.get(key);
    if (!existing) {
      return false;
    }
    existing.status = 'DEAD';
    existing.finishedAt = new Date();
    existing.completedAt = new Date();
    if (errorCode !== undefined) existing.errorCode = errorCode;
    if (errorMessage !== undefined) existing.errorMessage = errorMessage ?? null;
    return true;
  }

  async heartbeat(lockToken: string): Promise<boolean> {
    for (const step of this.stepsMap.values()) {
      if (step.lockToken === lockToken) {
        step.heartbeatAt = new Date();
        return true;
      }
    }
    return false;
  }

  async findByVideoId(videoId: string): Promise<ProcessingStepRecord[]> {
    const results: ProcessingStepRecord[] = [];
    for (const step of this.stepsMap.values()) {
      if (step.videoId === videoId) {
        results.push({ ...step });
      }
    }
    return results;
  }

  async countRunningStale(thresholdMs: number): Promise<number> {
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
    return count;
  }

  clear(): void {
    this.stepsMap.clear();
  }
}

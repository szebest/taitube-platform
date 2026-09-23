import type { QueueJob } from '@vp/core/ports';
import { classifyError } from '@vp/errors';
import { type Job, UnrecoverableError } from 'bullmq';
import { toQueueJob } from './job-mapping';

class CustomUnrecoverableError extends UnrecoverableError {
  code?: string;
  override cause?: unknown;
}

/** ADR-18 at the queue boundary: a permanent failure must not be retried, an unknown one is retried a little. */
function rethrowClassified(cause: unknown, attemptsMade: number): never {
  // This package is the one place allowed to import `bullmq`, so a foreign UnrecoverableError is
  // recognised by `instanceof` here rather than by name.
  if (cause instanceof UnrecoverableError) throw cause;

  const classification = classifyError(cause);
  const parks =
    classification === 'permanent' || (classification === 'unknown' && attemptsMade + 1 >= 3);
  if (!parks) throw cause;

  const unrecoverable = new CustomUnrecoverableError((cause as { message: string }).message);
  const code = (cause as { code?: string }).code;
  if (code) unrecoverable.code = code;
  unrecoverable.cause = cause;
  throw unrecoverable;
}

export function bullMqProcessor<T>(handler: (job: QueueJob<T>) => Promise<unknown>) {
  return async (job: Job): Promise<unknown> => {
    try {
      return await handler({
        ...toQueueJob<T>(job),
        updateProgress: async (progress: number | object) => {
          await job.updateProgress(progress);
        },
        getChildrenValues: async <R = Record<string, unknown>>() =>
          ((await job.getChildrenValues()) ?? {}) as R,
        getState: async () => job.getState(),
      });
    } catch (cause: unknown) {
      return rethrowClassified(cause, job.attemptsMade ?? 0);
    }
  };
}

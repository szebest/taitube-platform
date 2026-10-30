import type { QueueJob } from '@vp/core/ports';
import { type AnyFailure, toPipelineError } from '@vp/errors';
import { type Result, isErr } from '@vp/result';

/**
 * The line `runner.ts` runs on every job outcome. A suite that drives a stage through a real queue
 * has to convert the same way, or a returned failure reads as a completed job and never reaches
 * the retry policy or the DLQ.
 */
export function throughRunner<T, R>(
  processor: (job: QueueJob<T>) => Promise<Result<R, AnyFailure>>
): (job: QueueJob<T>) => Promise<R> {
  return async (job) => {
    const outcome = await processor(job);
    if (isErr(outcome)) throw toPipelineError(outcome.error);
    return outcome.value;
  };
}

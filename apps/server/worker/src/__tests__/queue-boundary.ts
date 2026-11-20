import { type AnyFailure, toPipelineError } from '@kit/errors';
import { type Result, isErr } from '@kit/result';
import type { QueueJob } from '@vp/core/ports';
import { errorCodeRegistry } from '@vp/errors';

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
    if (isErr(outcome)) throw toPipelineError(errorCodeRegistry, outcome.error);
    return outcome.value;
  };
}

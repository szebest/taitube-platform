import type { QueueJob } from '@vp/core/ports';
import type { AnyFailure } from '@vp/errors';
import { err, type Result } from '@vp/result';
import { invalidField } from '@vp/validation';
import type { ZodType } from 'zod';

/**
 * A payload is `unknown` until its contract says otherwise, so each stage reads the one its queue
 * carries here, and a job that does not match fails permanently instead of reaching the stage.
 */
export function consuming<T>(
  payload: ZodType<T>,
  process: (job: QueueJob<T>) => Promise<Result<unknown, AnyFailure>>
): (job: QueueJob<unknown>) => Promise<Result<unknown, AnyFailure>> {
  return async (job) => {
    const parsed = payload.safeParse(job.data);
    return parsed.success
      ? process({ ...job, data: parsed.data })
      : err(invalidField('data', `${job.name} payload rejected: ${parsed.error.message}`, {}));
  };
}

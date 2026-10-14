import { QUEUES, type QueueName } from '@vp/job-contracts';
import { type Result, err, ok } from '@vp/result';
import { type InvalidField, invalidField } from '@vp/validation';

/** BullMQ throws on `:` in either, so the separator is `--` (SDD §9.1). */
export function validateQueueName(name: string): QueueName {
  if (name.includes(':')) {
    throw new Error(`Queue name must not contain ':' (got "${name}")`);
  }
  if (!QUEUES.includes(name as QueueName)) {
    throw new Error(`Unknown queue name "${name}". Allowed queues are: ${QUEUES.join(', ')}`);
  }
  return name as QueueName;
}

export function validateJobId(jobId: string): Result<string, InvalidField> {
  return jobId.includes(':')
    ? err(
        invalidField(
          'jobId',
          `Job ID must not contain ':' (got "${jobId}"). Use '--' separator per SDD §9.1`,
          {}
        )
      )
    : ok(jobId);
}

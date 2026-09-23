import { QUEUES, type QueueName } from '@vp/job-contracts';

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

export function validateJobId(jobId: string): string {
  if (jobId.includes(':')) {
    throw new Error(
      `Job ID must not contain ':' (got "${jobId}"). Use '--' separator per SDD §9.1`
    );
  }
  return jobId;
}

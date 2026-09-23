import type { FlowJobNode, QueueJob, QueueJobOptions } from '@vp/core/ports';
import type { FlowJobNode as BullFlowJobNode, Job, JobsOptions } from 'bullmq';

export type PortJobsOptions = Pick<
  JobsOptions,
  'jobId' | 'attempts' | 'priority' | 'backoff' | 'removeOnComplete' | 'removeOnFail'
>;

export function toJobsOptions(options: QueueJobOptions | undefined): PortJobsOptions {
  return {
    jobId: options?.jobId,
    attempts: options?.attempts,
    priority: options?.priority,
    backoff: options?.backoff as JobsOptions['backoff'],
    removeOnComplete: options?.removeOnComplete as JobsOptions['removeOnComplete'],
    removeOnFail: options?.removeOnFail as JobsOptions['removeOnFail'],
  };
}

export function toFlowJobNode(node: FlowJobNode): BullFlowJobNode {
  const job = {
    name: node.name,
    queueName: node.queueName,
    data: node.data,
    opts: node.opts && {
      ...toJobsOptions(node.opts),
      failParentOnFailure: node.opts.failParentOnFailure,
      removeDependencyOnFailure: node.opts.removeDependencyOnFailure,
      ignoreDependencyOnFailure: node.opts.ignoreDependencyOnFailure,
    },
  };
  return node.children ? { ...job, children: node.children.map(toFlowJobNode) } : job;
}

/** The shape a listener or a caller sees: a BullMQ job reduced to the port's vocabulary. */
export function toQueueJob<T = unknown>(job: Job): QueueJob<T> {
  return {
    id: job.id ?? '',
    name: job.name,
    data: job.data as T,
    opts: {
      jobId: job.id,
      attempts: job.opts?.attempts,
      priority: job.opts?.priority,
    },
    attemptsMade: job.attemptsMade,
  };
}

import type { QueueUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { HealthCheckable } from './health-checkable';
import type { QueueJobOptions } from './job-queue';

export interface FlowJobNode<T = unknown> {
  name: string;
  queueName: string;
  data: T;
  opts?: QueueJobOptions & {
    failParentOnFailure?: boolean;
    removeDependencyOnFailure?: boolean;
    ignoreDependencyOnFailure?: boolean;
  };
  children?: FlowJobNode[];
}

export abstract class FlowProducerPort implements HealthCheckable<QueueUnavailable> {
  abstract checkHealth(): Promise<Result<void, QueueUnavailable>>;
  abstract add<T = unknown>(node: FlowJobNode<T>): Promise<Result<unknown, QueueUnavailable>>;
  abstract close(): Promise<Result<void, QueueUnavailable>>;
}

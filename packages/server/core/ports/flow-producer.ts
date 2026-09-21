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

export abstract class FlowProducerPort implements HealthCheckable {
  abstract checkHealth(): Promise<boolean>;
  abstract add<T = unknown>(node: FlowJobNode<T>): Promise<unknown>;
  abstract close(): Promise<void>;
}

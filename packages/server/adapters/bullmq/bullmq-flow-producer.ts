import { type FlowJobNode, FlowProducerPort } from '@vp/core/ports';
import { type QueueUnavailable, queueUnavailable } from '@vp/errors';
import { type Result, assertNever, fromPromise } from '@vp/result';
import { type ConnectionOptions, FlowProducer } from 'bullmq';
import { checkBackendHealth } from './connection';
import { toFlowJobNode } from './job-mapping';

export type BullMqFlowProducerConfig =
  | { type: 'producer'; producer: FlowProducer }
  | { type: 'connection'; connection: ConnectionOptions; prefix: string };

export class BullMqFlowProducer extends FlowProducerPort {
  private readonly producer: FlowProducer;

  constructor(config: BullMqFlowProducerConfig) {
    super();
    switch (config.type) {
      case 'producer':
        this.producer = config.producer;
        return;
      case 'connection':
        this.producer = new FlowProducer({ connection: config.connection, prefix: config.prefix });
        return;
      default:
        assertNever(config, 'BullMqFlowProducerConfig');
    }
  }

  private unavailable(operation: string) {
    return (cause: unknown): QueueUnavailable => queueUnavailable(operation, cause);
  }

  async checkHealth(): Promise<Result<void, QueueUnavailable>> {
    return checkBackendHealth(this.producer);
  }

  async add<T = unknown>(node: FlowJobNode<T>): Promise<Result<unknown, QueueUnavailable>> {
    return fromPromise(() => this.producer.add(toFlowJobNode(node)), this.unavailable('add'));
  }

  async close(): Promise<Result<void, QueueUnavailable>> {
    return fromPromise(() => this.producer.close(), this.unavailable('close'));
  }
}

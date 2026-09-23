import { type FlowJobNode, FlowProducerPort } from '@vp/core/ports';
import { type QueueUnavailable, queueUnavailable } from '@vp/errors';
import { type Result, err, fromPromise, ok } from '@vp/result';
import { type ConnectionOptions, FlowProducer, type FlowJob } from 'bullmq';
import { getRedisConnectionOptions } from './connection';

export interface BullMqFlowProducerConfig {
  connection?: ConnectionOptions;
  producer?: FlowProducer;
}

export class BullMqFlowProducer extends FlowProducerPort {
  private readonly producer: FlowProducer;

  constructor(config: BullMqFlowProducerConfig = {}) {
    super();
    this.producer =
      config.producer ??
      new FlowProducer({
        connection: getRedisConnectionOptions(config.connection),
        prefix: 'bull',
      });
  }

  private unavailable(operation: string) {
    return (cause: unknown): QueueUnavailable => queueUnavailable(operation, cause);
  }

  async checkHealth(): Promise<Result<void, QueueUnavailable>> {
    const pinged = await fromPromise(async () => {
      const client = await (
        this.producer as unknown as { client: Promise<{ ping(): Promise<string> } | undefined> }
      ).client;
      return client ? await client.ping() : 'PONG';
    }, this.unavailable('checkHealth'));

    if (!pinged.ok) return pinged;
    return pinged.value === 'PONG' ? ok() : err(queueUnavailable('checkHealth', pinged.value));
  }

  async add<T = unknown>(node: FlowJobNode<T>): Promise<Result<unknown, QueueUnavailable>> {
    return fromPromise(
      () => this.producer.add(node as unknown as FlowJob),
      this.unavailable('add')
    );
  }

  async close(): Promise<Result<void, QueueUnavailable>> {
    return fromPromise(() => this.producer.close(), this.unavailable('close'));
  }
}

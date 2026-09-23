import { type FlowJobNode, FlowProducerPort } from '@vp/core/ports';
import { type QueueUnavailable, queueUnavailable } from '@vp/errors';
import { type Result, assertNever, err, fromPromise, ok } from '@vp/result';
import { type ConnectionOptions, type FlowJob, FlowProducer } from 'bullmq';

export type BullMqFlowProducerConfig =
  | { type: 'producer'; producer: FlowProducer }
  | { type: 'connection'; connection: ConnectionOptions };

export class BullMqFlowProducer extends FlowProducerPort {
  private readonly producer: FlowProducer;

  constructor(config: BullMqFlowProducerConfig) {
    super();
    switch (config.type) {
      case 'producer':
        this.producer = config.producer;
        return;
      case 'connection':
        this.producer = new FlowProducer({ connection: config.connection, prefix: 'bull' });
        return;
      default:
        assertNever(config, 'BullMqFlowProducerConfig');
    }
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

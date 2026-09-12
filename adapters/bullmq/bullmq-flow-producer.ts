import { type FlowJobNode, FlowProducerPort, QueueError } from '@vp/core/ports';
import { type ConnectionOptions, FlowProducer } from 'bullmq';
import { getRedisConnectionOptions } from './connection';

export interface BullMqFlowProducerConfig {
  connection?: ConnectionOptions;
  producer?: FlowProducer;
}

export class BullMqFlowProducer extends FlowProducerPort {
  private readonly producer: FlowProducer;

  constructor(config: BullMqFlowProducerConfig = {}) {
    super();
    if (config.producer) {
      this.producer = config.producer;
      return;
    }

    const connection = getRedisConnectionOptions(config.connection);

    this.producer = new FlowProducer({
      connection,
      prefix: 'bull',
    });
  }

  async checkHealth(): Promise<boolean> {
    try {
      const client = await (this.producer as any).client;
      if (!client) return true;
      const res = await client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  async add<T = unknown>(node: FlowJobNode<T>): Promise<unknown> {
    try {
      return await this.producer.add(node as any);
    } catch (err: unknown) {
      throw new QueueError(
        `Failed to add flow for parent "${node.name}": ${(err as Error).message}`,
        {
          cause: err,
        }
      );
    }
  }

  async close(): Promise<void> {
    try {
      await this.producer.close();
    } catch (err: unknown) {
      throw new QueueError(`Failed to close FlowProducer: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }
}

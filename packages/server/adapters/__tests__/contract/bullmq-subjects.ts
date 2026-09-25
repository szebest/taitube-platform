import { expectOk } from '@vp/testing/result';
import type { ConnectionOptions } from 'bullmq';
import { BullMqFlowProducer } from '../../bullmq/bullmq-flow-producer';
import { BullMqJobQueue } from '../../bullmq/bullmq-job-queue';
import { redisConnectionOptions } from '../../bullmq/connection';
import type { FlowProducerSubject } from './flow-producer.contract';
import { inMemoryFlowProducerSubject, inMemoryJobQueueSubject } from './in-memory-port-subjects';
import type { JobQueueSubject } from './job-queue.contract';
import { claimRealServices } from './real-services';

const PREFIX = 'contract';

async function openQueue(name: string, connection: ConnectionOptions): Promise<BullMqJobQueue> {
  const queue = new BullMqJobQueue({ type: 'connection', name, connection, prefix: PREFIX });
  expectOk(await queue.checkHealth());
  return queue;
}

/** Drops every key the queue wrote, so a contract run leaves the Redis it borrowed as it was. */
async function discard(queue: BullMqJobQueue): Promise<void> {
  await queue.getRawQueue().obliterate({ force: true });
  expectOk(await queue.close());
}

/** The double in `unit` and under `bun test`; BullMQ over the integration run's Redis otherwise. */
export async function bullMqJobQueueSubject(name: string): Promise<JobQueueSubject> {
  const services = claimRealServices();
  if (!services) return inMemoryJobQueueSubject(name);

  const connection = redisConnectionOptions(services.redis.url, services.redis.password);
  const queue = await openQueue(name, connection);
  return { queue, close: () => discard(queue) };
}

/** The double in `unit` and under `bun test`; BullMQ over the integration run's Redis otherwise. */
export async function bullMqFlowProducerSubject(): Promise<FlowProducerSubject> {
  const services = claimRealServices();
  if (!services) return inMemoryFlowProducerSubject();

  const connection = redisConnectionOptions(services.redis.url, services.redis.password);
  const producer = new BullMqFlowProducer({ type: 'connection', connection, prefix: PREFIX });
  expectOk(await producer.checkHealth());
  const queues = new Map<string, BullMqJobQueue>();
  return {
    producer,
    queue: (name) => {
      const queue = new BullMqJobQueue({ type: 'connection', name, connection, prefix: PREFIX });
      queues.set(name, queue);
      return queue;
    },
    close: async () => {
      for (const queue of queues.values()) await discard(queue);
      expectOk(await producer.close());
    },
  };
}

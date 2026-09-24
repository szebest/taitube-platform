import { LazyQueueRegistry } from '../../composition/queue-registry';
import { InMemoryFlowProducer } from '../../in-memory/in-memory-flow-producer';
import { InMemoryJobQueue } from '../../in-memory/in-memory-job-queue';
import type { FlowProducerSubject } from './flow-producer.contract';
import type { JobQueueSubject } from './job-queue.contract';

export async function inMemoryJobQueueSubject(name: string): Promise<JobQueueSubject> {
  const queue = new InMemoryJobQueue(name);
  return {
    queue,
    close: async () => {
      await queue.close();
    },
  };
}

export async function inMemoryFlowProducerSubject(): Promise<FlowProducerSubject> {
  const queues = new LazyQueueRegistry((name) => new InMemoryJobQueue(name));
  return {
    producer: new InMemoryFlowProducer((name) => queues.get(name)),
    queue: (name) => queues.get(name),
    close: async () => {
      await queues.close();
    },
  };
}

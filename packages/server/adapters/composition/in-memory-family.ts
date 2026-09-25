import { type Container, closeOnDispose, token } from '@vp/composition';
import { portBoardQueues } from '../bullmq/port-board-queues';
import { InMemoryCacheClient } from '../in-memory/in-memory-cache-client';
import { InMemoryDatabaseClient } from '../in-memory/in-memory-database-client';
import { InMemoryFlowProducer } from '../in-memory/in-memory-flow-producer';
import { InMemoryJobQueue } from '../in-memory/in-memory-job-queue';
import { InMemoryMultipartStorage } from '../in-memory/in-memory-multipart-storage';
import { InMemoryStorageClient } from '../in-memory/in-memory-storage-client';
import { InMemorySubscriptionCache } from '../in-memory/in-memory-subscription-cache';
import { InMemoryViewBuffer } from '../in-memory/in-memory-view-buffer';
import { InMemoryRepositories } from '../in-memory/repositories/in-memory-repositories';
import { MeteredMultipartStorage } from '../metered/metered-multipart-storage';
import { MeteredStorageClient } from '../metered/metered-storage-client';
import { Adapters } from './adapter-tokens';
import { LazyQueueRegistry } from './queue-registry';

const InMemoryQueues = token<LazyQueueRegistry<InMemoryJobQueue>>('QueueRegistry');

export function registerFamily(c: Container): void {
  c.provide(Adapters.DbClient, () => new InMemoryDatabaseClient(), closeOnDispose)
    .provide(Adapters.Repositories, () => new InMemoryRepositories())
    .provide(Adapters.Cache, () => new InMemoryCacheClient(), closeOnDispose)
    .provide(
      Adapters.Storage,
      (c) => new MeteredStorageClient(new InMemoryStorageClient(), c.get(Adapters.Metrics)),
      closeOnDispose
    )
    .provide(
      Adapters.Multipart,
      (c) =>
        new MeteredMultipartStorage(
          new InMemoryMultipartStorage(c.get(Adapters.Storage)),
          c.get(Adapters.Metrics)
        ),
      closeOnDispose
    )
    .provide(
      InMemoryQueues,
      () => new LazyQueueRegistry((name) => new InMemoryJobQueue(name)),
      closeOnDispose
    )
    .provide(Adapters.QueueRegistry, (c) => c.get(InMemoryQueues))
    .provide(
      Adapters.FlowProducer,
      (c) => {
        const queues = c.get(InMemoryQueues);
        return new InMemoryFlowProducer((name) => queues.get(name));
      },
      closeOnDispose
    )
    .provide(Adapters.SubscriptionCache, () => new InMemorySubscriptionCache())
    .provide(Adapters.ViewBuffer, () => new InMemoryViewBuffer())
    .provide(Adapters.BoardQueues, () => portBoardQueues);
}

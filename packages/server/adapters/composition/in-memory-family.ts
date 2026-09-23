import { type Container, closeOnDispose } from '@vp/composition';
import { InMemoryCacheClient } from '../in-memory/in-memory-cache-client';
import { InMemoryDatabaseClient } from '../in-memory/in-memory-database-client';
import { InMemoryFlowProducer } from '../in-memory/in-memory-flow-producer';
import { InMemoryJobQueue } from '../in-memory/in-memory-job-queue';
import { InMemoryMultipartStorage } from '../in-memory/in-memory-multipart-storage';
import { InMemoryStorageClient } from '../in-memory/in-memory-storage-client';
import { InMemorySubscriptionCache } from '../in-memory/in-memory-subscription-cache';
import { InMemoryRepositories } from '../in-memory/repositories/in-memory-repositories';
import { Adapters } from './adapter-tokens';
import { LazyQueueRegistry } from './queue-registry';

export function registerFamily(c: Container): void {
  c.provide(Adapters.DbClient, () => new InMemoryDatabaseClient(), closeOnDispose)
    .provide(Adapters.Repositories, () => new InMemoryRepositories())
    .provide(Adapters.Cache, () => new InMemoryCacheClient(), closeOnDispose)
    .provide(Adapters.Storage, () => new InMemoryStorageClient(), closeOnDispose)
    .provide(
      Adapters.Multipart,
      (c) => new InMemoryMultipartStorage(c.get(Adapters.Storage)),
      closeOnDispose
    )
    .provide(
      Adapters.QueueRegistry,
      () => new LazyQueueRegistry((name) => new InMemoryJobQueue(name)),
      closeOnDispose
    )
    .provide(
      Adapters.FlowProducer,
      (c) => {
        const registry = c.get(Adapters.QueueRegistry);
        return new InMemoryFlowProducer((name) => registry.get(name));
      },
      closeOnDispose
    )
    .provide(Adapters.SubscriptionCache, () => new InMemorySubscriptionCache());
}

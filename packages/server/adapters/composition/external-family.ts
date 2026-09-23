import { type Container, closeOnDispose, token } from '@vp/composition';
import type { Repositories } from '@vp/core/repositories';
import { bullBoardQueues } from '../bullmq/bull-board-queues';
import { BullMqFlowProducer } from '../bullmq/bullmq-flow-producer';
import { BullMqJobQueue } from '../bullmq/bullmq-job-queue';
import { redisConnectionOptions } from '../bullmq/connection';
import { PostgresDatabaseClient } from '../postgres/postgres-database-client';
import { PostgresRepositories } from '../postgres/repositories/postgres-repositories';
import { RedisCacheClient } from '../redis/redis-cache-client';
import { RedisSubscriptionCacheAdapter } from '../redis/redis-subscription-cache.adapter';
import { S3MultipartStorage } from '../s3/s3-multipart-storage';
import { S3StorageClient } from '../s3/s3-storage-client';
import { Adapters } from './adapter-tokens';
import { LazyQueueRegistry } from './queue-registry';

/** Overriding `Cache`, `Storage` or `DbClient` must not take the connection a sibling shares. */
const Postgres = token<PostgresDatabaseClient>('PostgresDatabaseClient');
const Redis = token<RedisCacheClient>('RedisCacheClient');
const S3 = token<S3StorageClient>('S3StorageClient');

export function registerFamily(c: Container): void {
  const config = c.get(Adapters.Config);
  const connection = redisConnectionOptions(config.redis.url, config.redis.password);

  c.provide(
    Postgres,
    () =>
      new PostgresDatabaseClient({
        type: 'url',
        url: config.postgres.url,
        max: config.postgres.poolMax,
      }),
    closeOnDispose
  )
    .provide(Adapters.DbClient, (c) => c.get(Postgres))
    .provide<Repositories, PostgresRepositories>(
      Adapters.Repositories,
      (c) => new PostgresRepositories({ type: 'sql', sql: c.get(Postgres).getRawSql() }),
      closeOnDispose
    )
    .provide(
      Redis,
      () => new RedisCacheClient({ type: 'url', url: config.redis.url }),
      closeOnDispose
    )
    .provide(Adapters.Cache, (c) => c.get(Redis))
    .provide(S3, () => new S3StorageClient({ type: 'connection', ...config.s3 }), closeOnDispose)
    .provide(Adapters.Storage, (c) => c.get(S3))
    .provide(
      Adapters.Multipart,
      (c) => new S3MultipartStorage({ type: 'storage', storageClient: c.get(S3) }),
      closeOnDispose
    )
    .provide(
      Adapters.QueueRegistry,
      () =>
        new LazyQueueRegistry(
          (name) => new BullMqJobQueue({ type: 'connection', name, connection })
        ),
      closeOnDispose
    )
    .provide(
      Adapters.FlowProducer,
      () => new BullMqFlowProducer({ type: 'connection', connection }),
      closeOnDispose
    )
    .provide(
      Adapters.SubscriptionCache,
      (c) =>
        new RedisSubscriptionCacheAdapter({
          redis: c.get(Redis).getRedis(),
          ...config.caches.subscriptions,
        })
    )
    .provide(Adapters.BoardQueues, () => bullBoardQueues);
}

import { type Container, closeOnDispose, token } from '@vp/composition';
import { CircuitBreaker } from '@vp/concurrency';
import type { Repositories } from '@vp/core/repositories';
import { bullBoardQueues } from '../bullmq/bull-board-queues';
import { BullMqFlowProducer } from '../bullmq/bullmq-flow-producer';
import { BullMqJobQueue } from '../bullmq/bullmq-job-queue';
import { redisConnectionOptions } from '../bullmq/connection';
import { MeteredMultipartStorage } from '../metered/metered-multipart-storage';
import { MeteredStorageClient } from '../metered/metered-storage-client';
import { PostgresDatabaseClient } from '../postgres/postgres-database-client';
import { PostgresRepositories } from '../postgres/repositories/postgres-repositories';
import { RedisCacheClient } from '../redis/redis-cache-client';
import { RedisSubscriptionCacheAdapter } from '../redis/redis-subscription-cache.adapter';
import { RedisViewBufferAdapter } from '../redis/redis-view-buffer.adapter';
import { FallbackViewBuffer } from '../resilient/fallback-view-buffer';
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
      () =>
        new RedisCacheClient({
          type: 'url',
          url: config.redis.url,
          pubsubUrl: config.redis.pubsubUrl,
          password: config.redis.password,
        }),
      closeOnDispose
    )
    .provide(Adapters.Cache, (c) => c.get(Redis))
    .provide(
      S3,
      () =>
        new S3StorageClient({
          type: 'connection',
          healthBucket: config.buckets.raw,
          ...config.s3,
        }),
      closeOnDispose
    )
    .provide(
      Adapters.Storage,
      (c) => new MeteredStorageClient(c.get(S3), c.get(Adapters.Metrics)),
      // S3 above owns the client this wraps and closes it; closing it here too would close it twice.
      { dispose: () => undefined }
    )
    .provide(
      Adapters.Multipart,
      (c) =>
        new MeteredMultipartStorage(
          new S3MultipartStorage({ type: 'storage', storageClient: c.get(S3) }),
          c.get(Adapters.Metrics)
        ),
      closeOnDispose
    )
    .provide(
      Adapters.QueueRegistry,
      () =>
        new LazyQueueRegistry(
          (name) =>
            new BullMqJobQueue({
              type: 'connection',
              name,
              connection,
              prefix: config.redis.bullmqPrefix,
            })
        ),
      closeOnDispose
    )
    .provide(
      Adapters.FlowProducer,
      () =>
        new BullMqFlowProducer({
          type: 'connection',
          connection,
          prefix: config.redis.bullmqPrefix,
        }),
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
    .provide(
      Adapters.ViewBuffer,
      (c) =>
        new FallbackViewBuffer({
          primary: new RedisViewBufferAdapter({
            redis: c.get(Redis).getRedis(),
            dedupTtlSeconds: config.views.dedupTtlSeconds,
          }),
          breaker: new CircuitBreaker({
            failureThreshold: config.views.breakerFailureThreshold,
            cooldownMs: config.views.breakerCooldownMs,
            now: Date.now,
          }),
          capacity: config.views.fallbackCapacity,
          metrics: c.get(Adapters.Metrics),
        })
    )
    .provide(Adapters.BoardQueues, () => bullBoardQueues);
}

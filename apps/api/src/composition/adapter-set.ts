import {
  BullMqJobQueue,
  CaslAuthorizationAdapter,
  CategoryCacheService,
  InMemoryCacheClient,
  InMemoryDatabaseClient,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
  InMemorySubscriptionCache,
  PostgresDatabaseClient,
  PostgresRepositories,
  RedisCacheClient,
  RedisReactionCacheAdapter,
  RedisSubscriptionCacheAdapter,
  S3MultipartStorage,
  S3StorageClient,
} from '@vp/adapters';
import type {
  AuthorizationPort,
  CacheClient,
  DatabaseClient,
  JobQueue,
  MultipartStorage,
  ReactionCachePort,
  StorageClient,
  SubscriptionCachePort,
} from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { QUEUES } from '@vp/job-contracts';

/**
 * Which family of adapters `buildApp` wires when the caller does not hand one in.
 * It is a parameter rather than something inferred from the objects passed, because
 * the inference this replaced compared `constructor.name` against a string literal
 * and any minifier would have silently flipped it to production adapters.
 */
export type AdapterKind = 'in-memory' | 'external';

export interface AdapterSet {
  kind: AdapterKind;
  dbClient: DatabaseClient;
  repositories: Repositories;
  cache: CacheClient;
  storage: StorageClient;
  multipart: MultipartStorage;
  queues: Map<string, JobQueue>;
  probeQueue?: JobQueue;
  reactionCache: ReactionCachePort;
  subscriptionCache: SubscriptionCachePort;
  categoryCache: CategoryCacheService;
  authorization: AuthorizationPort;
}

export type AdapterOverrides = Partial<AdapterSet>;

function defaultKind(): AdapterKind {
  return process.env['NODE_ENV'] === 'test' ? 'in-memory' : 'external';
}

function buildQueues(kind: AdapterKind): Map<string, JobQueue> {
  const queues = new Map<string, JobQueue>();
  for (const name of QUEUES) {
    queues.set(
      name,
      kind === 'in-memory' ? new InMemoryJobQueue(name) : new BullMqJobQueue({ name })
    );
  }
  return queues;
}

export function resolveAdapterSet(overrides: AdapterOverrides = {}): AdapterSet {
  const kind = overrides.kind ?? defaultKind();
  const inMemory = kind === 'in-memory';

  const dbClient =
    overrides.dbClient ?? (inMemory ? new InMemoryDatabaseClient() : new PostgresDatabaseClient());
  const repositories =
    overrides.repositories ?? (inMemory ? new InMemoryRepositories() : new PostgresRepositories());
  const storage =
    overrides.storage ?? (inMemory ? new InMemoryStorageClient() : new S3StorageClient());
  const cache = overrides.cache ?? (inMemory ? new InMemoryCacheClient() : new RedisCacheClient());
  const multipart =
    overrides.multipart ??
    (inMemory
      ? new InMemoryMultipartStorage(storage)
      : new S3MultipartStorage({
          storageClient: storage instanceof S3StorageClient ? storage : undefined,
        }));

  const queues = overrides.queues ?? buildQueues(kind);

  return {
    kind,
    dbClient,
    repositories,
    cache,
    storage,
    multipart,
    queues,
    probeQueue: overrides.probeQueue ?? queues.get('probe'),
    reactionCache: overrides.reactionCache ?? new RedisReactionCacheAdapter({ cache }),
    subscriptionCache:
      overrides.subscriptionCache ??
      (cache instanceof RedisCacheClient
        ? new RedisSubscriptionCacheAdapter({ redis: cache.getRedis() })
        : new InMemorySubscriptionCache()),
    categoryCache: overrides.categoryCache ?? new CategoryCacheService({ cache }),
    authorization: overrides.authorization ?? new CaslAuthorizationAdapter(),
  };
}

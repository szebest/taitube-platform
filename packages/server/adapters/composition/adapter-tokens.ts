import type { BaseAdapter } from '@bull-board/api/baseAdapter';
import { token } from '@vp/composition';
import type {
  AuthorizationPort,
  CacheClient,
  CategoryCachePort,
  DatabaseClient,
  FlowProducerPort,
  JobQueue,
  MultipartStorage,
  ReactionCachePort,
  StorageClient,
  SubscriptionCachePort,
} from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { AppConfig } from '@vp/env-schema';
import type { QueueRegistry } from './queue-registry';

export const Adapters = {
  Config: token<AppConfig>('Config'),
  DbClient: token<DatabaseClient>('DbClient'),
  Repositories: token<Repositories>('Repositories'),
  Cache: token<CacheClient>('Cache'),
  Storage: token<StorageClient>('Storage'),
  Multipart: token<MultipartStorage>('Multipart'),
  QueueRegistry: token<QueueRegistry>('QueueRegistry'),
  Queues: token<Map<string, JobQueue>>('Queues'),
  ProbeQueue: token<JobQueue | undefined>('ProbeQueue'),
  FlowProducer: token<FlowProducerPort>('FlowProducer'),
  ReactionCache: token<ReactionCachePort>('ReactionCache'),
  SubscriptionCache: token<SubscriptionCachePort>('SubscriptionCache'),
  CategoryCache: token<CategoryCachePort>('CategoryCache'),
  Authorization: token<AuthorizationPort>('Authorization'),
  BoardQueues: token<(queues: Iterable<JobQueue>) => BaseAdapter[]>('BoardQueues'),
} as const;

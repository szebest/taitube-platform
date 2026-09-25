import type { BaseAdapter } from '@bull-board/api/baseAdapter';
import { token } from '@vp/composition';
import type {
  AuthorizationPort,
  CacheClient,
  CategoryCachePort,
  CommentCachePort,
  DatabaseClient,
  FlowProducerPort,
  JobQueue,
  MultipartStorage,
  ReactionCachePort,
  StorageClient,
  SubscriptionCachePort,
  TokenVerifier,
  ViewBufferPort,
} from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { AppConfig } from '@vp/env-schema';
import type { PipelineMetrics } from '@vp/observability';
import type { QueueRegistry } from './queue-registry';

export const Adapters = {
  Config: token<AppConfig>('Config'),
  Metrics: token<PipelineMetrics>('Metrics'),
  DbClient: token<DatabaseClient>('DbClient'),
  Repositories: token<Repositories>('Repositories'),
  Cache: token<CacheClient>('Cache'),
  Storage: token<StorageClient>('Storage'),
  Multipart: token<MultipartStorage>('Multipart'),
  QueueRegistry: token<QueueRegistry>('QueueRegistry'),
  Queues: token<Map<string, JobQueue>>('Queues'),
  ProbeQueue: token<JobQueue>('ProbeQueue'),
  FlowProducer: token<FlowProducerPort>('FlowProducer'),
  ReactionCache: token<ReactionCachePort>('ReactionCache'),
  SubscriptionCache: token<SubscriptionCachePort>('SubscriptionCache'),
  CategoryCache: token<CategoryCachePort>('CategoryCache'),
  ViewBuffer: token<ViewBufferPort>('ViewBuffer'),
  CommentCache: token<CommentCachePort>('CommentCache'),
  Authorization: token<AuthorizationPort>('Authorization'),
  TokenVerifier: token<TokenVerifier>('TokenVerifier'),
  BoardQueues: token<(queues: Iterable<JobQueue>) => BaseAdapter[]>('BoardQueues'),
} as const;

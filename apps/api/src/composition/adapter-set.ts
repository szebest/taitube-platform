import { Adapters } from '@vp/adapters/composition';
import type { Container, Token } from '@vp/composition';
import type {
  AuthorizationPort,
  CacheClient,
  CategoryCachePort,
  DatabaseClient,
  JobQueue,
  MultipartStorage,
  ReactionCachePort,
  StorageClient,
  SubscriptionCachePort,
  TokenVerifier,
} from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';

/** The adapters a test may hand `buildApp` instead of the ones the configuration would build. */
export interface AdapterOverrides {
  dbClient?: DatabaseClient;
  repositories?: Repositories;
  cache?: CacheClient;
  storage?: StorageClient;
  multipart?: MultipartStorage;
  queues?: Map<string, JobQueue>;
  probeQueue?: JobQueue;
  reactionCache?: ReactionCachePort;
  subscriptionCache?: SubscriptionCachePort;
  categoryCache?: CategoryCachePort;
  authorization?: AuthorizationPort;
  tokenVerifier?: TokenVerifier;
}

const OVERRIDABLE: Record<keyof AdapterOverrides, { readonly name: string }> = {
  dbClient: Adapters.DbClient,
  repositories: Adapters.Repositories,
  cache: Adapters.Cache,
  storage: Adapters.Storage,
  multipart: Adapters.Multipart,
  queues: Adapters.Queues,
  probeQueue: Adapters.ProbeQueue,
  reactionCache: Adapters.ReactionCache,
  subscriptionCache: Adapters.SubscriptionCache,
  categoryCache: Adapters.CategoryCache,
  authorization: Adapters.Authorization,
  tokenVerifier: Adapters.TokenVerifier,
};

export function overrideAdapters(c: Container, overrides: AdapterOverrides = {}): Container {
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      c.override(OVERRIDABLE[key as keyof typeof OVERRIDABLE] as Token<unknown>, value);
    }
  }
  return c;
}

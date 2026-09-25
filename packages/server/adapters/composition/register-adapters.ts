import type { Container } from '@vp/composition';
import type { JobQueue, TokenVerifier } from '@vp/core/ports';
import { getDevJwks } from '@vp/dev-token';
import type { AppConfig, AuthConfig } from '@vp/env-schema';
import { QUEUES } from '@vp/job-contracts';
import { createMetricsRegistry } from '@vp/observability';
import { assertNever } from '@vp/result';
import { DevTokenVerifier } from '../auth/dev-token-verifier';
import { JwksTokenVerifier } from '../auth/jwks-token-verifier';
import { CaslAuthorizationAdapter } from '../authorization/casl-authorization-adapter';
import { RedisCategoryCacheAdapter } from '../redis/redis-category-cache.adapter';
import { RedisCommentCacheAdapter } from '../redis/redis-comment-cache.adapter';
import { RedisReactionCacheAdapter } from '../redis/redis-reaction-cache.adapter';
import { Adapters } from './adapter-tokens';
import { queueNamed } from './queue-registry';

function tokenVerifier(auth: AuthConfig): TokenVerifier {
  switch (auth.type) {
    case 'jwks':
      return new JwksTokenVerifier({
        ...auth,
        fetch: (url, init) => fetch(url, init),
        now: Date.now,
      });
    case 'dev':
      return new DevTokenVerifier({ ...auth, jwks: getDevJwks(), now: Date.now });
    default:
      return assertNever(auth, 'auth.type');
  }
}

/**
 * The only place the platform chooses between the in-memory and the external adapter family.
 * The family is imported on demand, so an external process never loads a test double.
 */
export async function registerAdapters(c: Container, config: AppConfig): Promise<Container> {
  const family =
    config.kind === 'in-memory'
      ? await import('./in-memory-family')
      : await import('./external-family');

  family.registerFamily(
    c
      .provide(Adapters.Config, () => config)
      .provide(Adapters.Metrics, () => createMetricsRegistry())
  );

  return c
    .provide(Adapters.Queues, (c) => {
      const registry = c.get(Adapters.QueueRegistry);
      return new Map<string, JobQueue>(QUEUES.map((name) => [name, registry.get(name)]));
    })
    .provide(Adapters.ProbeQueue, (c) => queueNamed(c.get(Adapters.Queues), 'probe'))
    .provide(Adapters.Authorization, () => new CaslAuthorizationAdapter())
    .provide(Adapters.TokenVerifier, () => tokenVerifier(config.auth))
    .provide(
      Adapters.ReactionCache,
      (c) =>
        new RedisReactionCacheAdapter({
          backend: { type: 'cache', cache: c.get(Adapters.Cache) },
          ...config.caches.reactions,
        })
    )
    .provide(
      Adapters.CommentCache,
      (c) =>
        new RedisCommentCacheAdapter({
          cache: c.get(Adapters.Cache),
          hotTtlSeconds: config.caches.comments.hotTtlSeconds,
        })
    )
    .provide(
      Adapters.CategoryCache,
      (c) =>
        new RedisCategoryCacheAdapter({
          cache: c.get(Adapters.Cache),
          ...config.caches.categories,
        }),
      {
        start: (cache) => cache.start(),
        dispose: (cache) => cache.close(),
      }
    );
}

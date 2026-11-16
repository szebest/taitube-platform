import { API_TOKEN_LIMITS } from '@vp/domain';
import { MS_PER_MINUTE } from '@vp/domain/time';
import type { FastifyInstance, FastifyRequest } from 'fastify';

/** Seconds to wait when the request's token is over its limit; `null` while it is under. */
export type TokenRateLimit = (request: FastifyRequest) => Promise<number | null>;

/**
 * Counts per token id, in `@fastify/rate-limit`'s store, apart from the per-address limits of the
 * anonymous routes. Read after the auth hook has set `request.user`, which names the token.
 */
export function tokenRateLimit(app: FastifyInstance): TokenRateLimit {
  const limit = app.createRateLimit({
    max: API_TOKEN_LIMITS.requestsPerMinute,
    timeWindow: MS_PER_MINUTE,
    keyGenerator: (request) => `api-token:${request.user?.token?.id ?? ''}`,
  });
  return async (request) => {
    const verdict = await limit(request);
    return !verdict.isAllowed && verdict.isExceeded ? verdict.ttlInSeconds : null;
  };
}

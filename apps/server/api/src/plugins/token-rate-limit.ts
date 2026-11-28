import { MS_PER_MINUTE } from '@kit/primitives';
import { isErr } from '@kit/result';
import type { FixedWindowCounterPort } from '@vp/core/ports';
import { API_TOKEN_LIMITS } from '@vp/domain';
import type { FastifyRequest } from 'fastify';

/** Seconds to wait when the request's token is over its limit; `null` while it is under. */
export type TokenRateLimit = (request: FastifyRequest) => Promise<number | null>;

/**
 * Counts per token id in the counter every API process shares, apart from the per-address limits
 * of the anonymous routes. Read after the auth hook has set `request.user`, which names the token.
 * A dead counter costs the limit for one request, never the request.
 */
export function tokenRateLimit(counter: FixedWindowCounterPort): TokenRateLimit {
  return async (request) => {
    const hit = await counter.hit(`api-token:${request.user?.token?.id ?? ''}`, MS_PER_MINUTE);
    if (isErr(hit) || hit.value.count <= API_TOKEN_LIMITS.requestsPerMinute) return null;
    return Math.ceil(hit.value.resetInMs / 1000);
  };
}

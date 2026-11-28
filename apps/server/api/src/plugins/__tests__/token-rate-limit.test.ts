import { err } from '@kit/result';
import { InMemoryFixedWindowCounter } from '@vp/adapters/in-memory';
import type { FixedWindowCounterPort } from '@vp/core/ports';
import { API_TOKEN_LIMITS } from '@vp/domain';
import { cacheUnavailable } from '@vp/errors';
import type { FastifyRequest } from 'fastify';
import { tokenRateLimit } from '../token-rate-limit';

const PER_MINUTE = API_TOKEN_LIMITS.requestsPerMinute;

/** Only what the limiter reads: the token on `request.user`. */
function requestWith(tokenId: string): FastifyRequest {
  return {
    user: { id: 'usr-1', role: 'USER', token: { id: tokenId, channelId: 'c', scopes: [] } },
  } as unknown as FastifyRequest;
}

describe('apps/server/api/plugins: token rate limit', () => {
  it('lets a token make 60 requests a minute and tells the 61st when to come back', async () => {
    let nowMs = 0;
    const limit = tokenRateLimit(new InMemoryFixedWindowCounter(() => nowMs));
    const request = requestWith('tok-1');

    const verdicts = [];
    for (let n = 0; n <= PER_MINUTE; n += 1) {
      verdicts.push(await limit(request));
      nowMs += 100;
    }

    expect(verdicts.slice(0, PER_MINUTE)).toEqual(Array(PER_MINUTE).fill(null));
    expect(verdicts.at(-1)).toBe(54);
  });

  it('counts each token on its own', async () => {
    const limit = tokenRateLimit(new InMemoryFixedWindowCounter());
    for (let n = 0; n < PER_MINUTE; n += 1) await limit(requestWith('tok-1'));

    expect([await limit(requestWith('tok-1')), await limit(requestWith('tok-2'))]).toEqual([
      expect.any(Number),
      null,
    ]);
  });

  it('lets the request through when the counter is down', async () => {
    const dead: FixedWindowCounterPort = {
      hit: async () => err(cacheUnavailable.during('hit')(new Error('down'))),
    };

    expect(await tokenRateLimit(dead)(requestWith('tok-1'))).toBeNull();
  });
});

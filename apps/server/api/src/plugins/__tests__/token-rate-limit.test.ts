import rateLimit from '@fastify/rate-limit';
import { API_TOKEN_LIMITS } from '@vp/domain';
import fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { tokenRateLimit } from '../token-rate-limit';

const PER_MINUTE = API_TOKEN_LIMITS.requestsPerMinute;

/** Only what the limiter reads: the token on `request.user` and the route's own limit config. */
function requestWith(tokenId: string): FastifyRequest {
  return {
    user: { id: 'usr-1', role: 'USER', token: { id: tokenId, channelId: 'c', scopes: [] } },
    routeOptions: { config: {} },
  } as unknown as FastifyRequest;
}

describe('apps/server/api/plugins: token rate limit', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify({ logger: false });
    await app.register(rateLimit, { global: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lets a token make 60 requests a minute and tells the 61st when to come back', async () => {
    const limit = tokenRateLimit(app);
    const request = requestWith('tok-1');

    const verdicts = [];
    for (let n = 0; n <= PER_MINUTE; n += 1) verdicts.push(await limit(request));

    expect(verdicts.slice(0, PER_MINUTE)).toEqual(Array(PER_MINUTE).fill(null));
    expect(verdicts.at(-1)).toBeGreaterThan(0);
  });

  it('counts each token on its own', async () => {
    const limit = tokenRateLimit(app);
    for (let n = 0; n < PER_MINUTE; n += 1) await limit(requestWith('tok-1'));

    expect([await limit(requestWith('tok-1')), await limit(requestWith('tok-2'))]).toEqual([
      expect.any(Number),
      null,
    ]);
  });
});

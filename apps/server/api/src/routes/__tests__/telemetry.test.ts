import { Adapters } from '@vp/adapters/composition';
import { MAX_WEB_VITALS_PER_BATCH } from '@vp/api-contracts';
import type { Container } from '@vp/composition';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../../__tests__/test-app';

const URL = '/v1/telemetry/vitals';
const LCP = { name: 'LCP', value: 1250, route: '/watch/$videoId' };

const batchOf = (overrides: Record<string, unknown> = {}) => ({
  app: 'web',
  vitals: [LCP],
  ...overrides,
});

describe('telemetry routes', () => {
  let app: FastifyInstance;
  let container: Container;

  const send = (payload: string, contentType = 'application/json') =>
    app.inject({ method: 'POST', url: URL, payload, headers: { 'content-type': contentType } });

  const scrape = () => container.get(Adapters.Metrics).registry.metrics();

  const lcpCount = async () => {
    const lcp = await container.get(Adapters.Metrics).frontendLcp.get();
    return (
      lcp.values.find(
        ({ metricName, labels }) =>
          metricName === 'frontend_lcp_seconds_count' &&
          labels.app === 'web' &&
          labels.route === LCP.route
      )?.value ?? 0
    );
  };

  beforeAll(async () => {
    ({ app, container } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['application/json', 'text/plain;charset=UTF-8'])(
    'records an anonymous %s batch with an empty 204, exported by app and route',
    async (contentType) => {
      const before = await lcpCount();

      const res = await send(JSON.stringify(batchOf()), contentType);

      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
      expect(await lcpCount()).toBe(before + 1);
      expect(await scrape()).toContain(
        'frontend_lcp_seconds_bucket{le="1.5",app="web",route="/watch/$videoId"}'
      );
    }
  );

  it.each([
    ['an unknown metric', batchOf({ vitals: [{ ...LCP, name: 'FID' }] }), 'application/json'],
    [
      'a URL in place of a route id',
      batchOf({ vitals: [{ ...LCP, route: 'https://x.test/a?b' }] }),
      'application/json',
    ],
    ['text that is not JSON', 'LCP=1250', 'text/plain'],
  ])('refuses %s with a 400', async (_name, payload, contentType) => {
    const res = await send(
      typeof payload === 'string' ? payload : JSON.stringify(payload),
      contentType
    );

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED });
  });

  it('refuses a body over the vitals limit with a 413 before validating it', async () => {
    const padded = batchOf({
      vitals: Array(MAX_WEB_VITALS_PER_BATCH).fill({ ...LCP, route: `/${'a'.repeat(1000)}` }),
    });

    const res = await send(JSON.stringify(padded));

    expect(res.statusCode).toBe(413);
  });
});

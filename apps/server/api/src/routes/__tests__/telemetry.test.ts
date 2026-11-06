import { Adapters } from '@vp/adapters/composition';
import { MAX_WEB_VITALS_PER_BATCH } from '@vp/api-contracts';
import type { Container } from '@vp/composition';
import { type AppConfigOverrides, inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../../__tests__/test-app';

const URL = '/v1/telemetry/vitals';
const LCP = { name: 'LCP', value: 1250, route: '/watch/$videoId' };

const batchOf = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ app: 'web', vitals: [LCP], ...overrides });

const buildTelemetryApp = (webVitals: AppConfigOverrides['webVitals'] = {}) =>
  buildTestApp({ config: inProcessAppConfig({ webVitals }) });

const post = (target: FastifyInstance, payload: string, contentType = 'application/json') =>
  target.inject({ method: 'POST', url: URL, payload, headers: { 'content-type': contentType } });

describe('telemetry routes', () => {
  let app: FastifyInstance;
  let container: Container;

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
    ({ app, container } = await buildTelemetryApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['application/json', 'text/plain;charset=UTF-8'])(
    'records an anonymous %s batch with an empty 204, exported by app and route',
    async (contentType) => {
      const before = await lcpCount();

      const res = await post(app, batchOf(), contentType);

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
    const res = await post(app, payload, contentType);

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED });
  });

  it('refuses a body over the vitals limit with a 413 before validating it', async () => {
    const padded = batchOf({
      vitals: Array(MAX_WEB_VITALS_PER_BATCH).fill({ ...LCP, route: `/${'a'.repeat(1000)}` }),
    });

    const res = await post(app, padded);

    expect(res.statusCode).toBe(413);
  });

  it('answers 429 past the batches one address may send in a minute', async () => {
    const limited = await buildTelemetryApp({ ratePerMinute: 2 });

    const statuses: number[] = [];
    for (let sent = 0; sent < 3; sent++) {
      statuses.push((await post(limited.app, batchOf())).statusCode);
    }
    await limited.app.close();

    expect(statuses).toEqual([204, 204, 429]);
  });
});

describe('playback telemetry route', () => {
  const PLAYBACK_URL = '/v1/telemetry/playback';
  const EVENT = {
    videoId: '0f8fad5b-d9cb-469f-a165-70867728950e',
    sessionUuid: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    eventType: 'playback_start',
    currentTime: 0,
    duration: 120,
  };

  let app: FastifyInstance;
  let container: Container;

  const send = (target: FastifyInstance, payload: unknown, contentType = 'application/json') =>
    target.inject({
      method: 'POST',
      url: PLAYBACK_URL,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      headers: { 'content-type': contentType },
    });

  beforeAll(async () => {
    ({ app, container } = await buildTelemetryApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['application/json', 'text/plain;charset=UTF-8'])(
    'records an anonymous %s event with an empty 204 and exports the start',
    async (contentType) => {
      const res = await send(app, EVENT, contentType);

      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
      expect(await container.get(Adapters.Metrics).registry.metrics()).toContain(
        'video_playback_starts_total'
      );
    }
  );

  it.each([
    ['an unknown event type', { ...EVENT, eventType: 'seek' }],
    ['a session that is not a UUID', { ...EVENT, sessionUuid: 'viewer-1' }],
    ['text that is not JSON', 'start'],
  ])('refuses %s with a 400', async (_name, payload) => {
    const res = await send(app, payload);

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED });
  });

  it('refuses a body over the playback limit with a 413', async () => {
    const res = await send(app, { ...EVENT, rendition: 'a'.repeat(4096) });

    expect(res.statusCode).toBe(413);
  });

  it('answers 429 past the events one address may send in a minute', async () => {
    const limited = await buildTestApp({
      config: inProcessAppConfig({ playbackTelemetry: { ratePerMinute: 2 } }),
    });

    const statuses: number[] = [];
    for (let sent = 0; sent < 3; sent++) {
      statuses.push((await send(limited.app, EVENT)).statusCode);
    }
    await limited.app.close();

    expect(statuses).toEqual([204, 204, 429]);
  });
});

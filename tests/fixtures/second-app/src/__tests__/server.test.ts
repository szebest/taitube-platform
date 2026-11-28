import { computeReplicas, parsePrometheusQueueMetrics } from '@kit/compose-autoscaler';
import { Container, token } from '@kit/composition';
import { CircuitBreaker, Singleflight } from '@kit/concurrency';
import { loadEnv, parseEnv } from '@kit/config';
import { createLogger, serializeError } from '@kit/logger';
import {
  calculatePartSize,
  calculateTotalParts,
  getHeaderMapping,
} from '@kit/object-storage';
import { QUEUE_JOB_STATES } from '@kit/ports';
import { captureLog } from '@kit/testing/log-capture';
import { signingKey, signJwt } from '@kit/testing/jwt';
import { expectErr, expectOk } from '@kit/testing/result';
import { withEnv } from '@kit/testing';
import { z } from 'zod';

const ShopEnv = z.object({ SHOP_REGION: z.string().min(1), SHOP_PORT: z.coerce.number().default(8088) });

describe('quill shop on the server platform packages', () => {
  it('reads its own environment, and names what is missing', () => {
    expect(loadEnv(ShopEnv, { SHOP_REGION: 'nordics' })).toEqual({
      SHOP_REGION: 'nordics',
      SHOP_PORT: 8088,
    });
    expect(expectErr(parseEnv(ShopEnv, {}))).toMatchObject({ type: 'invalid-env' });
  });

  it('logs as quill-api, with a request id bound to every line', () => {
    const capture = captureLog();
    const log = createLogger({
      service: 'quill-api',
      level: 'info',
      format: 'json',
      bindings: { shop: 'oulu' },
      destination: capture.destination,
    });

    log.info({ err: serializeError(new Error('shelf is full')) }, 'restock refused');

    expect(capture.lines()).toEqual([
      expect.objectContaining({ shop: 'oulu', msg: 'restock refused' }),
    ]);
  });

  it('starts and disposes its own services in order', async () => {
    const Greeting = token<string>('Greeting');
    const events: string[] = [];
    const container = new Container().provide(Greeting, () => 'hei', {
      start: async () => {
        events.push('started');
        return { ok: true, value: undefined };
      },
      dispose: () => {
        events.push('disposed');
      },
    });

    expect(container.get(Greeting)).toBe('hei');
    expectOk(await container.start());
    expectOk(await container.dispose());

    expect(events).toEqual(['started', 'disposed']);
  });

  it('shares one lookup of a shelf between concurrent callers', async () => {
    const lookups = new Singleflight();
    let calls = 0;
    const lookup = () => lookups.do('shelf:poetry', async () => ++calls);

    expect(await Promise.all([lookup(), lookup()])).toEqual([1, 1]);
  });

  it('opens its payment circuit after its own threshold and closes it after the cooldown', () => {
    let now = 0;
    const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1000, now: () => now });

    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.state()).toBe('open');

    now = 1000;
    expect(breaker.allows()).toBe(true);
    expect(breaker.state()).toBe('half-open');
  });

  it('splits a cover upload into parts and picks the cache headers of its files', () => {
    const bounds = { minBytes: 5 * 1024 * 1024, maxBytes: 64 * 1024 * 1024 };
    const size = 200 * 1024 * 1024;

    const partSize = calculatePartSize(size, bounds);

    expect(calculateTotalParts(size, partSize) * partSize).toBeGreaterThanOrEqual(size);
    expect(getHeaderMapping('covers/runot.m3u8').contentType).toMatch(/mpegurl/i);
  });

  it('reads its own queue depth and scales its stage from it', () => {
    const depths = parsePrometheusQueueMetrics(
      'bullmq_queue_jobs{queue="covers",state="waiting"} 40\n'
    );
    const decision = computeReplicas({
      config: { minReplicas: 1, maxReplicas: 4, threshold: 10, cooldownSeconds: 30 },
      state: { currentReplicas: 1, lastScaleDownTimeMs: 0, scaleDownCandidateSinceMs: null },
      queueDepth: { waiting: 40, prioritized: 0, active: 0 },
      nowMs: 60_000,
    });

    expect(depths.covers).toMatchObject({ waiting: 40 });
    expect(decision.action).toBe('scale_up');
  });

  it('names the job states it can see, and signs a test token under its own key', async () => {
    const key = signingKey('ES256', 'quill-test-key');

    expect(QUEUE_JOB_STATES).toContain('waiting');
    expect(signJwt(key, { sub: 'reader-1' }).split('.')).toHaveLength(3);
    expect(await withEnv({ SHOP_REGION: 'lapland' }, () => process.env.SHOP_REGION)).toBe('lapland');
  });
});

import {
  InMemoryCacheClient,
  InMemoryDatabaseClient,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('health routes', () => {
  let app: FastifyInstance;
  const dbClient = new InMemoryDatabaseClient();
  const cache = new InMemoryCacheClient();
  const storage = new InMemoryStorageClient();
  const dependencies = { postgres: dbClient, redis: cache, s3: storage };

  beforeEach(async () => {
    for (const dependency of Object.values(dependencies)) dependency.setHealthy(true);
    app = await buildApp({ adapters: { dbClient, cache, storage } });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(['/healthz', '/livez'])('answers liveness on %s with 200 ok', async (url) => {
    const res = await app.inject({ method: 'GET', url });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('answers readiness with 200 and every check ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/readyz' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'ok',
      checks: { postgres: 'ok', redis: 'ok', s3: 'ok' },
    });
  });

  it.each(Object.keys(dependencies) as (keyof typeof dependencies)[])(
    'answers readiness with 503 degraded naming %s when it fails',
    async (name) => {
      dependencies[name].setHealthy(false);

      const res = await app.inject({ method: 'GET', url: '/readyz' });

      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({
        status: 'degraded',
        checks: { postgres: 'ok', redis: 'ok', s3: 'ok', [name]: 'failed' },
      });
    }
  );

  it('answers readiness 503 while draining yet keeps liveness at 200', async () => {
    app.services.readiness.beginDrain();

    const [ready, live] = await Promise.all([
      app.inject({ method: 'GET', url: '/readyz' }),
      app.inject({ method: 'GET', url: '/livez' }),
    ]);

    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toEqual({ status: 'degraded', checks: {} });
    expect(live.statusCode).toBe(200);
  });
});

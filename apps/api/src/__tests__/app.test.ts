import { Adapters } from '@vp/adapters/composition';
import { InMemoryStorageClient } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { buildApp, composeApp } from '../app';

describe('apps/api: composeApp', () => {
  it('hands routes the services and the configuration it composed', async () => {
    const config = inProcessAppConfig({ cdn: 'http://cdn.composed' });
    const { app, container } = await composeApp({ config });

    expect(app.config).toBe(config);
    expect(app.services.videoService).toBeDefined();
    expect(container.get(Adapters.Config)).toBe(config);
    await app.close();
  });

  it('registers every plugin in the route table', async () => {
    const app = await buildApp({ config: inProcessAppConfig() });
    await app.ready();

    const registered = app.printRoutes({ commonPrefix: false });
    for (const path of ['/healthz', '/v1/uploads', '/v1/videos', '/admin/queues', '/v1/feed']) {
      expect(registered).toContain(path);
    }
    await app.close();
  });

  it('builds over an adapter a test hands it instead of the configured one', async () => {
    const storage = new InMemoryStorageClient();
    const { app, container } = await composeApp({
      config: inProcessAppConfig(),
      adapters: { storage },
    });

    expect(container.get(Adapters.Storage)).toBe(storage);
    await app.close();
  });

  it('disposes the container when the app closes, and leaves an override to its owner', async () => {
    const storage = new InMemoryStorageClient();
    const storageClose = vi.spyOn(storage, 'close');
    const { app, container } = await composeApp({
      config: inProcessAppConfig(),
      adapters: { storage },
    });
    const cacheClose = vi.spyOn(container.get(Adapters.Cache), 'close');

    await app.close();

    expect(cacheClose).toHaveBeenCalledTimes(1);
    expect(storageClose).not.toHaveBeenCalled();
  });

  it.each([
    { origin: 'http://localhost:5173', allowed: 'http://localhost:5173' },
    { origin: 'https://evil.example', allowed: undefined },
  ])('answers CORS for $origin with $allowed', async ({ origin, allowed }) => {
    const app = await buildApp({
      config: inProcessAppConfig({ http: { corsOrigins: ['http://localhost:5173'] } }),
    });

    const res = await app.inject({ method: 'GET', url: '/healthz', headers: { origin } });

    expect(res.headers['access-control-allow-origin']).toBe(allowed);
    await app.close();
  });

  it('refuses a JSON body over the configured limit with 413', async () => {
    const app = await buildApp({ config: inProcessAppConfig({ http: { bodyLimitBytes: 64 } }) });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ filename: 'x'.repeat(128) }),
    });

    expect(res.statusCode).toBe(413);
    await app.close();
  });

  it('takes the client address from X-Forwarded-For only from a configured proxy', async () => {
    const trusting = await buildApp({
      config: inProcessAppConfig({ http: { trustProxy: ['127.0.0.1'] } }),
    });
    const untrusting = await buildApp({ config: inProcessAppConfig() });
    for (const app of [trusting, untrusting]) {
      app.get('/ip', async (request) => ({ ip: request.ip }));
    }
    const headers = { 'x-forwarded-for': '203.0.113.7' };

    const [trusted, untrusted] = await Promise.all(
      [trusting, untrusting].map((app) => app.inject({ method: 'GET', url: '/ip', headers }))
    );

    expect(trusted?.json().ip).toBe('203.0.113.7');
    expect(untrusted?.json().ip).toBe('127.0.0.1');
    await Promise.all([trusting.close(), untrusting.close()]);
  });
});

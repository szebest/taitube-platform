import { Adapters } from '@vp/adapters';
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
    const app = await buildApp();
    await app.ready();

    const registered = app.printRoutes({ commonPrefix: false });
    for (const path of ['/healthz', '/v1/uploads', '/v1/videos', '/admin/queues', '/v1/feed']) {
      expect(registered).toContain(path);
    }
    await app.close();
  });

  it('builds over an adapter a test hands it instead of the configured one', async () => {
    const storage = new InMemoryStorageClient();
    const { app, container } = await composeApp({ adapters: { storage } });

    expect(container.get(Adapters.Storage)).toBe(storage);
    await app.close();
  });

  it('disposes the container when the app closes, and leaves an override to its owner', async () => {
    const storage = new InMemoryStorageClient();
    const storageClose = vi.spyOn(storage, 'close');
    const { app, container } = await composeApp({ adapters: { storage } });
    const cacheClose = vi.spyOn(container.get(Adapters.Cache), 'close');

    await app.close();

    expect(cacheClose).toHaveBeenCalledTimes(1);
    expect(storageClose).not.toHaveBeenCalled();
  });
});

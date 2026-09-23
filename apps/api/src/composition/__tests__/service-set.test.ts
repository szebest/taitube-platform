import { InMemoryCacheClient } from '@vp/adapters';
import type { PatternMessageListener } from '@vp/core/ports';
import { type CacheUnavailable, ErrorCodes, cacheUnavailable } from '@vp/errors';
import { type Result, err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { resolveAdapterSet } from '../adapter-set';
import { createServiceSet } from '../service-set';

class UnsubscribableCache extends InMemoryCacheClient {
  override async psubscribe(
    _pattern: string,
    _listener: PatternMessageListener
  ): Promise<Result<void, CacheUnavailable>> {
    return err(cacheUnavailable('psubscribe'));
  }
}

const CONFIG = {
  cdnBaseUrl: 'http://localhost:9000/public',
  rawBucket: 'raw',
  limits: {},
};

describe('apps/api/composition: service set', () => {
  it('builds every service a route needs', async () => {
    const services = await createServiceSet(resolveAdapterSet({ kind: 'in-memory' }), CONFIG);

    expect(Object.keys(services).sort()).toEqual([
      'categoryService',
      'channelService',
      'dlqService',
      'feedService',
      'queueService',
      'reactionService',
      'sseHub',
      'sseService',
      'subscriptionService',
      'uploadService',
      'videoService',
    ]);

    await services.sseHub.close();
  });

  it('starts the SSE hub subscribed, so a stream never opens onto a silent hub', async () => {
    const adapters = resolveAdapterSet({ kind: 'in-memory' });

    const services = await createServiceSet(adapters, CONFIG);

    expect(services.sseHub.getActiveConnectionCount()).toBe(0);
    await services.sseHub.close();
  });

  it('refuses to build on a cache the hub cannot subscribe to', async () => {
    const adapters = resolveAdapterSet({ kind: 'in-memory', cache: new UnsubscribableCache() });

    await expect(createServiceSet(adapters, CONFIG)).rejects.toMatchObject({
      code: ErrorCodes.CACHE_UNAVAILABLE,
    });
  });

  it('applies the SSE limits it is given', async () => {
    const services = await createServiceSet(resolveAdapterSet({ kind: 'in-memory' }), {
      ...CONFIG,
      limits: { sseMaxPerUser: 1 },
    });

    expect(services.sseHub.getUserConnectionCount('nobody')).toBe(0);
    await services.sseHub.close();
  });

  it('gives the upload service the probe queue the adapter set opened', async () => {
    const adapters = resolveAdapterSet({ kind: 'in-memory' });

    const services = await createServiceSet(adapters, CONFIG);
    const started = expectOk(
      await services.uploadService.initiate(
        { id: '00000000-0000-7000-8000-00000000f001', role: 'CREATOR' },
        { filename: 'clip.mp4', sizeBytes: 1024, contentType: 'video/mp4' }
      )
    );

    expect(expectOk(await adapters.repositories.videos.findById(started.videoId))).toMatchObject({
      status: 'UPLOADING',
    });
    await services.sseHub.close();
  });
});

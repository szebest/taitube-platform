import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { InMemoryCacheClient } from '@vp/adapters/in-memory';
import { Container } from '@vp/composition';
import type { PatternMessageListener } from '@vp/core/ports';
import { inProcessAppConfig } from '@vp/env-schema';
import { type CacheUnavailable, ErrorCodes, cacheUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { Services, registerServices, resolveBackground } from '../services.module';

class UnsubscribableCache extends InMemoryCacheClient {
  override async psubscribe(
    _pattern: string,
    _listener: PatternMessageListener
  ): Promise<Result<void, CacheUnavailable>> {
    return err(cacheUnavailable('psubscribe'));
  }
}

const CREATOR: UserContext = { id: '00000000-0000-7000-8000-00000000f001', role: 'CREATOR' };
const VIEWER: UserContext = { id: '00000000-0000-7000-8000-00000000f002', role: 'USER' };
const CHANNEL_ID = '00000000-0000-7000-8000-00000000f003';
const VIDEO_ID = '00000000-0000-7000-8000-00000000f004';

async function services(cdn = 'http://cdn.example/public/') {
  return registerServices(await registerAdapters(new Container(), inProcessAppConfig({ cdn })));
}

describe('apps/api/composition: services module', () => {
  it('builds every service a route needs', async () => {
    const c = await services();

    expect(Object.keys(c.get(Services.ServiceSet)).sort()).toEqual([
      'analyticsService',
      'categoryService',
      'channelService',
      'dlqService',
      'feedService',
      'queueBoard',
      'queueService',
      'reactionService',
      'readiness',
      'sseHub',
      'sseService',
      'subscriptionService',
      'uploadService',
      'videoService',
      'viewService',
    ]);
    expectOk(await c.dispose());
  });

  it('gives the subscription feed and the video read the same absolute thumbnail URL', async () => {
    const c = await services();
    const repositories = c.get(Adapters.Repositories);
    expectOk(
      await repositories.channels.create({
        id: CHANNEL_ID,
        userId: CREATOR.id,
        handle: 'creator',
        displayName: 'Creator',
      })
    );
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: CREATOR.id,
        title: 'Thumbnail fixture',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/fixture.mp4',
        posterKey: `videos/${VIDEO_ID}/poster.jpg`,
      })
    );
    const { subscriptionService, videoService } = c.get(Services.ServiceSet);
    expectOk(await subscriptionService.subscribe(VIEWER, CHANNEL_ID));

    const feed = expectOk(await subscriptionService.getFeed(VIEWER, {}));
    const video = expectOk(await videoService.get(VIEWER, VIDEO_ID));

    expect(video.posterUrl).toBe(`http://cdn.example/public/videos/${VIDEO_ID}/poster.jpg`);
    expect(feed.items[0]?.posterUrl).toBe(video.posterUrl);
    expectOk(await c.dispose());
  });

  it('subscribes the SSE hub on start, and refuses to start on a cache that cannot take it', async () => {
    const c = await services();
    c.override(Adapters.Cache, new UnsubscribableCache());
    resolveBackground(c);

    const failed = expectErr(await c.start());

    expect(failed).toMatchObject({
      type: 'failed',
      token: 'SseHub',
      cause: { code: ErrorCodes.CACHE_UNAVAILABLE },
    });
  });
});

import { Singleflight } from '@kit/concurrency';
import { expectOk } from '@kit/testing/result';
import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { ExperimentOverlay } from '../experiment-overlay';
import { FeedService } from '../feed-service';
import { VideoService } from '../video-service';
import { ViewerProgress } from '../viewer-progress';
import { sessionShown, startTitleTest } from './running-test';
import { videoServiceDeps } from './service-deps';

const OWNER = '00000000-0000-7000-8000-0000000006a1';
const TESTED = '00000000-0000-7000-8000-0000000006a2';

describe('apps/server/api/services: FeedService test variants', () => {
  let repositories: InMemoryRepositories;
  let service: FeedService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    service = new FeedService({
      videoService: new VideoService(
        videoServiceDeps(repositories.videos, { channels: repositories.channels })
      ),
      viewerProgress: new ViewerProgress(repositories.watchHistory),
      experiments: new ExperimentOverlay(repositories.videoExperiments),
      cache: new InMemoryCacheClient(),
      singleflight: new Singleflight(),
      ...inProcessAppConfig().httpCache.feed,
    });
    await repositories.videos.create({
      id: TESTED,
      ownerId: OWNER,
      title: 'Control',
      visibility: 'public',
      status: 'READY',
      sourceKey: `raw/${TESTED}.mp4`,
    });
  });

  it('shows a session its variant over the cached control and keeps that page out of shared caches', async () => {
    const test = await startTitleTest(repositories, {
      videoId: TESTED,
      ownerId: OWNER,
      control: 'Control',
      challenger: 'A sharper title',
    });
    await service.getFeed({ sort: 'recent' });

    const shown = expectOk(
      await service.getFeed({ sort: 'recent' }, { sessionKey: sessionShown(test.id, 'b') })
    );
    const control = expectOk(await service.getFeed({ sort: 'recent' }));

    expect(shown.data.items[0]).toMatchObject({
      title: 'A sharper title',
      experiment: { id: test.id, variantId: 'b' },
    });
    expect(shown.headers['Cache-Control']).toMatch(/^private,/);
    expect(shown.etag).not.toBe(control.etag);
    expect(control.data.items[0]).toMatchObject({ title: 'Control' });
    expect(control.data.items[0]).not.toHaveProperty('experiment');
    expect(control.headers['Cache-Control']).toMatch(/^public,/);
  });
});

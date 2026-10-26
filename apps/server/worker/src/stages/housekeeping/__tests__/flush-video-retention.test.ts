import { InMemoryRepositories, InMemoryViewBuffer } from '@vp/adapters/in-memory';
import { cacheUnavailable, databaseUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { SEEDED } from '@vp/testing';
import { expectErr, expectOk } from '@vp/testing/result';
import { runFlushVideoRetention } from '../flush-video-retention';

const VIDEO = '00000000-0000-7000-8000-0000000000aa';

describe('housekeeping: flush-video-retention', () => {
  let repositories: InMemoryRepositories;
  let viewBuffer: InMemoryViewBuffer;

  const flush = () => runFlushVideoRetention({ repositories, viewBuffer });
  const curve = async () => expectOk(await repositories.videoViews.retentionCurve(VIDEO));

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    viewBuffer = new InMemoryViewBuffer();
    expectOk(
      await repositories.videos.create({
        id: VIDEO,
        ownerId: SEEDED.userId,
        sourceKey: 'raw/aa/source.mp4',
      })
    );
  });

  it('does nothing when no step is buffered', async () => {
    expect(expectOk(await flush())).toEqual({ steps: 0 });
  });

  it('moves the buffered steps into the table, adding to what it holds', async () => {
    await viewBuffer.recordRetention({ videoId: VIDEO, sessionId: 's1', percent: 5 });
    expect(expectOk(await flush())).toEqual({ steps: 2 });
    await viewBuffer.recordRetention({ videoId: VIDEO, sessionId: 's2', percent: 0 });

    expectOk(await flush());

    expect(await curve()).toEqual([
      { percent: 0, viewers: 2 },
      { percent: 5, viewers: 1 },
    ]);
  });

  it('reports a buffer it cannot drain', async () => {
    vi.spyOn(viewBuffer, 'drainRetention').mockResolvedValueOnce(
      err(cacheUnavailable('drainRetention'))
    );

    expect(expectErr(await flush()).code).toBe('CACHE_UNAVAILABLE');
  });

  it('reports a database it cannot write', async () => {
    await viewBuffer.recordRetention({ videoId: VIDEO, sessionId: 's1', percent: 0 });
    vi.spyOn(repositories.videoViews, 'applyRetention').mockResolvedValueOnce(
      err(databaseUnavailable('applyRetention'))
    );

    expect(expectErr(await flush()).code).toBe('DATABASE_UNAVAILABLE');
  });
});

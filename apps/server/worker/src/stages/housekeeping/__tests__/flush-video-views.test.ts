import { cacheUnavailable, databaseUnavailable } from '@kit/errors';
import { err } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories, InMemoryViewBuffer } from '@vp/adapters/in-memory';
import type { ViewBatch, ViewDevice } from '@vp/domain';
import { type PipelineMetrics, createPipelineMetrics } from '@vp/pipeline-metrics';
import { SEEDED } from '@vp/testing-fixtures';
import { runFlushVideoViews } from '../flush-video-views';

const DAY = '2026-03-10';
const HOUR = '2026-03-10T13:00:00.000Z';
const RETENTION_MS = 60_000;

describe('housekeeping: flush-video-views', () => {
  let repositories: InMemoryRepositories;
  let viewBuffer: InMemoryViewBuffer;
  let metrics: PipelineMetrics;
  let now: number;
  let videoId: string;

  const flush = () =>
    runFlushVideoViews({
      repositories,
      viewBuffer,
      metrics,
      now: () => now,
      batchRetentionMs: RETENTION_MS,
    });

  const record = (viewerId: string) =>
    viewBuffer.record({ videoId, viewerId, viewDate: DAY, viewHour: HOUR });

  const watch = (sessionId: string, watchedSeconds: number, device: ViewDevice = 'desktop') =>
    viewBuffer.recordPlayback({
      videoId,
      sessionId,
      viewDate: DAY,
      viewHour: HOUR,
      device,
      watchedSeconds,
      requiredSeconds: 5,
      shareLinkId: null,
      experiment: null,
    });

  const devices = async () =>
    expectOk(await repositories.videoViews.videoDevices(videoId, { from: DAY, to: DAY }));

  const curve = async () => expectOk(await repositories.videoViews.retentionCurve(videoId));

  const viewsCount = async () => expectOk(await repositories.videos.findById(videoId))?.viewsCount;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    viewBuffer = new InMemoryViewBuffer();
    metrics = createPipelineMetrics();
    now = 1_000_000;
    const video = expectOk(
      await repositories.videos.create({
        id: '00000000-0000-7000-8000-0000000000aa',
        ownerId: SEEDED.userId,
        channelId: SEEDED.channelId,
        sourceKey: 'raw/aa/source.mp4',
      })
    );
    videoId = video.id;
  });

  it('does nothing when nothing is buffered', async () => {
    expect(expectOk(await flush())).toEqual({ type: 'idle' });
  });

  it('moves the buffered views into the counters, the daily and the hourly rows, then releases them', async () => {
    await watch('viewer-1', 30);
    await watch('viewer-2', 50);

    const flushed = expectOk(await flush());

    expect(flushed).toMatchObject({ type: 'applied', views: 2 });
    expect(await viewsCount()).toBe(2);
    expect(
      expectOk(await repositories.videoViews.videoTimeline(videoId, { from: DAY, to: DAY }))
    ).toEqual([{ viewDate: DAY, views: 2, watchSeconds: 80 }]);
    expect(
      expectOk(await repositories.videoViews.videoHourly(videoId, { from: HOUR, to: HOUR }))
    ).toEqual([{ viewHour: HOUR, views: 2 }]);
    expect(expectOk(await flush())).toEqual({ type: 'idle' });
    expect((await metrics.viewsFlushed.get()).values[0]?.value).toBe(2);
  });

  it('adds a share link view, its watch seconds and its opens to the link in the same batch', async () => {
    const linkId = '00000000-0000-7000-8000-0000000000ab';
    const link = {
      id: linkId,
      targetType: 'video' as const,
      targetId: videoId,
      token: 'a'.repeat(22),
      label: null,
      expiresAt: null,
      createdBy: SEEDED.userId,
      revokedAt: null,
      createdAt: new Date(now),
    };
    expectOk(await repositories.shareLinks.create(link, 50));
    await viewBuffer.recordShareLinkOpen({ videoId, linkId, viewerKey: 'viewer-1', viewDate: DAY });
    await viewBuffer.recordPlayback({
      videoId,
      sessionId: 'viewer-1',
      viewDate: DAY,
      viewHour: HOUR,
      device: 'desktop',
      watchedSeconds: 30,
      requiredSeconds: 5,
      shareLinkId: linkId,
      experiment: null,
    });

    expectOk(await flush());

    expect(expectOk(await repositories.shareLinks.totalsFor([linkId])).get(linkId)).toEqual({
      opens: 1,
      views: 1,
      watchSeconds: 30,
    });
  });

  it('writes the device of each counted view with the daily row, and applies a replayed batch once', async () => {
    await watch('viewer-1', 30, 'mobile');
    await watch('viewer-2', 50, 'mobile');
    await watch('viewer-3', 50, 'desktop');
    await watch('viewer-4', 2, 'tablet');
    const apply = vi.spyOn(repositories.videoViews, 'applyBatch');
    vi.spyOn(viewBuffer, 'release').mockResolvedValueOnce(err(cacheUnavailable('releaseViews')));

    expectErr(await flush());
    const replayed = expectOk(await flush());

    expect(replayed).toEqual({
      type: 'already-applied',
      batchId: apply.mock.calls[0]?.[0].batchId,
    });
    expect(await devices()).toEqual([
      { device: 'mobile', views: 2 },
      { device: 'desktop', views: 1 },
    ]);
  });

  it('keeps the device counts of a failed apply pending, and applies each once on the next run', async () => {
    await watch('viewer-1', 30, 'mobile');
    vi.spyOn(repositories.videoViews, 'applyBatch').mockResolvedValueOnce(
      err(databaseUnavailable('applyViewBatch'))
    );

    expectErr(await flush());
    await watch('viewer-2', 30, 'tablet');
    expectOk(await flush());
    expectOk(await flush());

    expect(await devices()).toEqual([
      { device: 'mobile', views: 1 },
      { device: 'tablet', views: 1 },
    ]);
  });

  it('lands a burst of 10,000 views in Postgres as exactly the count the buffer took', async () => {
    const outcomes = await Promise.all(
      Array.from({ length: 10_000 }, (_, i) => record(`viewer-${i % 9_000}`))
    );
    const counted = outcomes.filter((outcome) => expectOk(outcome) === 'counted').length;

    expectOk(await flush());

    expect(counted).toBe(9_000);
    expect(await viewsCount()).toBe(counted);
  });

  it('recovers a batch whose flush died before the commit, and counts it once', async () => {
    await record('viewer-1');
    vi.spyOn(repositories.videoViews, 'applyBatch').mockResolvedValueOnce(
      err(databaseUnavailable('applyViewBatch'))
    );

    expectErr(await flush());
    await record('viewer-2');
    const recovered = expectOk(await flush());
    const next = expectOk(await flush());

    expect(recovered).toMatchObject({ type: 'applied', views: 1 });
    expect(next).toMatchObject({ type: 'applied', views: 1 });
    expect(await viewsCount()).toBe(2);
  });

  it('keeps the retention steps of a failed apply pending, and applies each once on the next run', async () => {
    await viewBuffer.recordRetention({ videoId, sessionId: 's1', percent: 5 });
    vi.spyOn(repositories.videoViews, 'applyBatch').mockResolvedValueOnce(
      err(databaseUnavailable('applyViewBatch'))
    );

    expectErr(await flush());
    await viewBuffer.recordRetention({ videoId, sessionId: 's2', percent: 0 });
    expectOk(await flush());
    expectOk(await flush());
    expectOk(await flush());

    expect(await curve()).toEqual([
      { percent: 0, viewers: 2 },
      { percent: 5, viewers: 1 },
    ]);
  });

  it('flushes a buffer holding only retention steps', async () => {
    await viewBuffer.recordRetention({ videoId, sessionId: 's1', percent: 0 });

    expect(expectOk(await flush())).toMatchObject({ type: 'applied', views: 0 });
    expect(await curve()).toEqual([{ percent: 0, viewers: 1 }]);
  });

  it('recognises a batch that committed before the flush died, and does not count it again', async () => {
    await record('viewer-1');
    vi.spyOn(viewBuffer, 'release').mockResolvedValueOnce(err(cacheUnavailable('releaseViews')));

    expectErr(await flush());
    const retried = expectOk(await flush());

    expect(retried).toMatchObject({ type: 'already-applied' });
    expect(await viewsCount()).toBe(1);
    expect(expectOk(await flush())).toEqual({ type: 'idle' });
  });

  it('tells the owner of a video in its first hours that the flush counted views for it', async () => {
    const video = expectOk(await repositories.videos.findById(videoId));
    if (video) video.readyAt = new Date(now);
    await record('viewer-1');

    expectOk(await flush());

    const events = expectOk(await repositories.userEvents.listFrom(SEEDED.userId, 0, 10));
    expect(events.map(({ type, payload }) => ({ type, payload }))).toEqual([
      { type: 'video.stats.updated', payload: { videoId } },
    ]);
  });

  it('releases the batch even when telling the stats panels fails', async () => {
    const video = expectOk(await repositories.videos.findById(videoId));
    if (video) video.readyAt = new Date(now);
    await record('viewer-1');
    vi.spyOn(repositories.userEvents, 'append').mockResolvedValue(
      err(databaseUnavailable('append'))
    );

    expect(expectOk(await flush())).toMatchObject({ type: 'applied', views: 1 });
    expect(expectOk(await flush())).toEqual({ type: 'idle' });
  });

  it('forgets applied batches once they are older than the retention', async () => {
    const forget = vi.spyOn(repositories.videoViews, 'forgetBatchesBefore');

    expectOk(await flush());

    expect(forget).toHaveBeenCalledWith(new Date(now - RETENTION_MS));
  });

  it('forgets the hourly rows older than the 48-hour window', async () => {
    now = Date.parse('2026-03-10T13:42:00.000Z');
    const forget = vi.spyOn(repositories.videoViews, 'forgetHoursBefore');

    expectOk(await flush());

    expect(forget).toHaveBeenCalledWith(new Date('2026-03-08T14:00:00.000Z'));
  });

  it('reports a buffer it cannot snapshot', async () => {
    vi.spyOn(viewBuffer, 'snapshot').mockResolvedValueOnce(err(cacheUnavailable('snapshotViews')));

    expect(expectErr(await flush()).code).toBe('CACHE_UNAVAILABLE');
  });

  it('applies the pending batch it is handed back, not a new one', async () => {
    await record('viewer-1');
    const apply = vi.spyOn(repositories.videoViews, 'applyBatch');
    vi.spyOn(viewBuffer, 'release').mockResolvedValueOnce(err(cacheUnavailable('releaseViews')));

    await flush();
    await flush();

    const [first, second] = apply.mock.calls.map(([batch]: [ViewBatch]) => batch.batchId);
    expect(second).toBe(first);
  });
});

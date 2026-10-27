import { InMemoryRepositories, InMemoryViewBuffer } from '@vp/adapters/in-memory';
import type { ViewBatch } from '@vp/domain';
import { cacheUnavailable, databaseUnavailable } from '@vp/errors';
import { type PipelineMetrics, createMetricsRegistry } from '@vp/observability';
import { err } from '@vp/result';
import { SEEDED } from '@vp/testing';
import { expectErr, expectOk } from '@vp/testing/result';
import { runFlushVideoViews } from '../flush-video-views';

const DAY = '2026-03-10';
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

  const record = (viewerId: string, watchSeconds = 10) =>
    viewBuffer.record({ videoId, viewerId, viewDate: DAY, watchSeconds });

  const viewsCount = async () => expectOk(await repositories.videos.findById(videoId))?.viewsCount;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    viewBuffer = new InMemoryViewBuffer();
    metrics = createMetricsRegistry();
    now = 1_000_000;
    const video = expectOk(
      await repositories.videos.create({
        id: '00000000-0000-7000-8000-0000000000aa',
        ownerId: SEEDED.userId,
        sourceKey: 'raw/aa/source.mp4',
      })
    );
    videoId = video.id;
  });

  it('does nothing when nothing is buffered', async () => {
    expect(expectOk(await flush())).toEqual({ type: 'idle' });
  });

  it('moves the buffered views into the counters and the daily rows, then releases them', async () => {
    await record('viewer-1', 30);
    await record('viewer-2', 50);

    const flushed = expectOk(await flush());

    expect(flushed).toMatchObject({ type: 'applied', views: 2 });
    expect(await viewsCount()).toBe(2);
    expect(
      expectOk(await repositories.videoViews.videoTimeline(videoId, { from: DAY, to: DAY }))
    ).toEqual([{ viewDate: DAY, views: 2, watchSeconds: 80 }]);
    expect(expectOk(await flush())).toEqual({ type: 'idle' });
    expect((await metrics.viewsFlushed.get()).values[0]?.value).toBe(2);
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

  it('recognises a batch that committed before the flush died, and does not count it again', async () => {
    await record('viewer-1');
    vi.spyOn(viewBuffer, 'release').mockResolvedValueOnce(err(cacheUnavailable('releaseViews')));

    expectErr(await flush());
    const retried = expectOk(await flush());

    expect(retried).toMatchObject({ type: 'already-applied' });
    expect(await viewsCount()).toBe(1);
    expect(expectOk(await flush())).toEqual({ type: 'idle' });
  });

  it('forgets applied batches once they are older than the retention', async () => {
    const forget = vi.spyOn(repositories.videoViews, 'forgetBatchesBefore');

    expectOk(await flush());

    expect(forget).toHaveBeenCalledWith(new Date(now - RETENTION_MS));
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

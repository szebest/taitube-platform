import { CircuitBreaker } from '@vp/concurrency';
import type { ViewEvent, ViewRecordOutcome } from '@vp/core/ports';
import { type CacheUnavailable, cacheUnavailable } from '@vp/errors';
import { type PipelineMetrics, createMetricsRegistry } from '@vp/observability';
import { type Result, err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { InMemoryViewBuffer } from '../../in-memory/in-memory-view-buffer';
import { FallbackViewBuffer } from '../fallback-view-buffer';

class FlakyBuffer extends InMemoryViewBuffer {
  down = false;
  readonly failing: boolean[] = [];

  override async recordAll(
    views: readonly ViewEvent[]
  ): Promise<Result<ViewRecordOutcome[], CacheUnavailable>> {
    const fails = this.failing.shift() ?? this.down;
    return fails ? err(cacheUnavailable('recordViews')) : super.recordAll(views);
  }
}

const DAY = '2026-03-10';

describe('FallbackViewBuffer', () => {
  let now: number;
  let primary: FlakyBuffer;
  let metrics: PipelineMetrics;
  let buffer: FallbackViewBuffer;
  let viewers: number;

  beforeEach(() => {
    now = 0;
    viewers = 0;
    primary = new FlakyBuffer();
    metrics = createMetricsRegistry();
    buffer = new FallbackViewBuffer({
      primary,
      breaker: new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1_000, now: () => now }),
      capacity: 3,
      metrics,
    });
  });

  const view = (viewerId = `viewer-${++viewers}`): ViewEvent => ({
    videoId: 'video-1',
    viewerId,
    viewDate: DAY,
    watchSeconds: 10,
  });

  const record = async (event = view()) => expectOk(await buffer.record(event));

  const circuitOpen = async () => (await metrics.viewBufferCircuitOpen.get()).values[0]?.value ?? 0;

  const drained = async () => expectOk(await primary.snapshot('batch'))?.counts ?? [];

  it('records through the primary while it answers', async () => {
    expect(await record()).toBe('counted');
    expect(await drained()).toEqual([
      { videoId: 'video-1', viewDate: DAY, views: 1, watchSeconds: 10 },
    ]);
  });

  it('holds views in process while the primary is down, and never fails the beacon', async () => {
    primary.down = true;
    const repeat = view();

    expect([await record(repeat), await record(repeat), await record()]).toEqual([
      'deferred',
      'duplicate',
      'deferred',
    ]);
  });

  it('opens the circuit after the threshold, so the primary is not asked until the cooldown', async () => {
    primary.down = true;
    await record();
    await record();
    primary.down = false;

    expect(await record()).toBe('deferred');
    expect(await circuitOpen()).toBe(1);
  });

  it('hands the held views to the primary once a trial call reaches it', async () => {
    primary.down = true;
    await record();
    await record();
    primary.down = false;
    now = 1_000;

    expect(await record()).toBe('counted');
    expect(await circuitOpen()).toBe(0);
    expect(await drained()).toEqual([
      { videoId: 'video-1', viewDate: DAY, views: 3, watchSeconds: 30 },
    ]);
  });

  it('keeps the held views when the hand-back fails, for the next call to retry', async () => {
    primary.down = true;
    await record();
    primary.down = false;
    primary.failing.push(false, true);
    await record();

    await record();

    expect(await drained()).toEqual([
      { videoId: 'video-1', viewDate: DAY, views: 3, watchSeconds: 30 },
    ]);
  });

  it('drops a view once the hold is full, still answering the beacon', async () => {
    primary.down = true;
    for (let i = 0; i < 3; i++) await record();

    expect(await record()).toBe('dropped');
  });

  it('drains through the primary alone', async () => {
    await record();

    const batch = expectOk(await buffer.snapshot('batch-1'));
    expectOk(await buffer.release('batch-1'));

    expect(batch?.batchId).toBe('batch-1');
    expect(expectOk(await primary.snapshot('batch-2'))).toBeNull();
  });

  it('does not count again a viewer it held once the hold is handed back', async () => {
    const heldViewer = view();
    primary.down = true;
    await record(heldViewer);
    primary.down = false;
    await record();

    expect(await record(heldViewer)).toBe('duplicate');
    expect(await drained()).toEqual([
      { videoId: 'video-1', viewDate: DAY, views: 2, watchSeconds: 20 },
    ]);
  });

  it('holds a whole set of views when the primary cannot take them', async () => {
    primary.down = true;

    expect(expectOk(await buffer.recordAll([view(), view()]))).toEqual(['deferred', 'deferred']);
  });
});

import { InMemoryViewBuffer } from '@vp/adapters/in-memory';
import type { PlaybackEvent } from '@vp/api-contracts';
import { cacheUnavailable } from '@vp/errors';
import { createMetricsRegistry, type PipelineMetrics } from '@vp/observability';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { PlaybackTelemetryService } from '../playback-telemetry-service';

const VIDEO = '00000000-0000-7000-8000-0000000000a1';
const SESSION = '0f8fad5b-d9cb-469f-a165-70867728950e';
const NOW = Date.parse('2026-03-10T12:00:00.000Z');

describe('PlaybackTelemetryService', () => {
  let viewBuffer: InMemoryViewBuffer;
  let metrics: PipelineMetrics;
  let service: PlaybackTelemetryService;

  beforeEach(() => {
    viewBuffer = new InMemoryViewBuffer();
    metrics = createMetricsRegistry();
    service = new PlaybackTelemetryService({
      viewBuffer,
      metrics,
      limits: { minWatchSeconds: 5 },
      now: () => NOW,
    });
  });

  const record = async (overrides: Partial<PlaybackEvent> = {}) =>
    expectOk(
      await service.record({
        videoId: VIDEO,
        sessionUuid: SESSION,
        eventType: 'heartbeat',
        currentTime: 0,
        duration: 100,
        rebufferingMs: 0,
        watchedSeconds: 0,
        ...overrides,
      })
    );

  const total = async (metric: 'playbackStarts' | 'playbackWatchSeconds') =>
    (await metrics[metric].get()).values[0]?.value ?? 0;

  const batch = async () => expectOk(await viewBuffer.snapshot('batch'));

  const steps = async () => (await batch())?.retention.map(({ percent }) => percent);

  const recorded = async (outcome: string) =>
    (await metrics.viewsRecorded.get()).values.find((value) => value.labels.outcome === outcome)
      ?.value ?? 0;

  it('counts a start once and the watch time of every event', async () => {
    await record({ eventType: 'playback_start' });
    await record({ watchedSeconds: 30 });
    await record({ eventType: 'playback_ended', watchedSeconds: 12.5 });

    expect(await total('playbackStarts')).toBe(1);
    expect(await total('playbackWatchSeconds')).toBe(42.5);
  });

  it('observes the stalled share of a segment, and nothing for an empty one', async () => {
    await record({ watchedSeconds: 9, rebufferingMs: 1000 });
    await record();

    const { values } = await metrics.playbackRebufferingRatio.get();
    expect(values.find(({ metricName }) => metricName?.endsWith('_count'))?.value).toBe(1);
    expect(values.find(({ metricName }) => metricName?.endsWith('_sum'))?.value).toBeCloseTo(0.1);
  });

  it('buffers the retention steps a session reached, once each', async () => {
    await record({ eventType: 'playback_start' });
    await record({ currentTime: 12 });
    await record({ currentTime: 12 });

    expect(await steps()).toEqual([0, 5, 10]);
  });

  it('counts one view and every second watched across the beacons of a session', async () => {
    await record({ eventType: 'playback_start' });
    await record({ watchedSeconds: 3 });
    await record({ watchedSeconds: 4 });
    await record({ eventType: 'playback_ended', watchedSeconds: 30 });

    expect((await batch())?.counts).toEqual([
      { videoId: VIDEO, viewDate: '2026-03-10', views: 1, watchSeconds: 37 },
    ]);
    expect(await recorded('counted')).toBe(1);
    expect(await recorded('duplicate')).toBe(0);
  });

  it('counts no view for a session under the minimum, and keeps its watch time', async () => {
    await record({ watchedSeconds: 2 });

    expect((await batch())?.counts).toEqual([
      { videoId: VIDEO, viewDate: '2026-03-10', views: 0, watchSeconds: 2 },
    ]);
    expect(await recorded('counted')).toBe(0);
  });

  it('counts a video shorter than the minimum once it is watched to the end', async () => {
    await record({ duration: 3, watchedSeconds: 3 });

    expect((await batch())?.counts).toEqual([expect.objectContaining({ views: 1 })]);
  });

  it('accepts the beacon when the buffer cannot take it', async () => {
    vi.spyOn(viewBuffer, 'recordRetention').mockResolvedValueOnce(
      err(cacheUnavailable('recordRetention'))
    );
    vi.spyOn(viewBuffer, 'recordPlayback').mockResolvedValueOnce(
      err(cacheUnavailable('recordPlayback'))
    );

    await record({ eventType: 'playback_start', watchedSeconds: 9 });

    expect(await total('playbackStarts')).toBe(1);
    expect(await recorded('dropped')).toBe(1);
  });
});

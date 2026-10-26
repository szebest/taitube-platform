import type { PlaybackEvent } from '@vp/api-contracts';
import { InMemoryViewBuffer } from '@vp/adapters/in-memory';
import { cacheUnavailable } from '@vp/errors';
import { type PipelineMetrics, createMetricsRegistry } from '@vp/observability';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { PlaybackTelemetryService } from '../playback-telemetry-service';

const VIDEO = '00000000-0000-7000-8000-0000000000a1';
const SESSION = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('PlaybackTelemetryService', () => {
  let viewBuffer: InMemoryViewBuffer;
  let metrics: PipelineMetrics;
  let service: PlaybackTelemetryService;

  beforeEach(() => {
    viewBuffer = new InMemoryViewBuffer();
    metrics = createMetricsRegistry();
    service = new PlaybackTelemetryService({ viewBuffer, metrics });
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

  const steps = async () =>
    expectOk(await viewBuffer.drainRetention()).map(({ percent }) => percent);

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

  it('accepts the beacon when the buffer cannot take it', async () => {
    vi.spyOn(viewBuffer, 'recordRetention').mockResolvedValueOnce(
      err(cacheUnavailable('recordRetention'))
    );

    await record({ eventType: 'playback_start' });

    expect(await total('playbackStarts')).toBe(1);
  });
});

import { err } from '@kit/result';
import { expectOk } from '@kit/testing/result';
import { InMemoryViewBuffer } from '@vp/adapters/in-memory';
import type { PlaybackEvent } from '@vp/api-contracts';
import { cacheUnavailable } from '@vp/errors';
import { type PipelineMetrics, createPipelineMetrics } from '@vp/pipeline-metrics';
import { PlaybackTelemetryService } from '../playback-telemetry-service';

const VIDEO = '00000000-0000-7000-8000-0000000000a1';
const SESSION = '0f8fad5b-d9cb-469f-a165-70867728950e';
const NOW = Date.parse('2026-03-10T12:00:00.000Z');
const TEST = '00000000-0000-7000-8000-0000000000e1';
const SHOWN = { experimentId: TEST, variantId: 'b' } as const;

describe('PlaybackTelemetryService', () => {
  let viewBuffer: InMemoryViewBuffer;
  let metrics: PipelineMetrics;
  let service: PlaybackTelemetryService;

  beforeEach(() => {
    viewBuffer = new InMemoryViewBuffer();
    metrics = createPipelineMetrics();
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

  it.each([
    ['the device the client reported', 'mobile', 'mobile'],
    ['unknown for a beacon without one', undefined, 'unknown'],
  ] as const)('buffers %s with the counted view', async (_name, device, expected) => {
    await record({ watchedSeconds: 9, device });

    expect((await batch())?.devices).toEqual([
      { videoId: VIDEO, viewDate: '2026-03-10', device: expected, views: 1 },
    ]);
  });

  it('buffers no device for a session under the minimum or one already counted', async () => {
    await record({
      sessionUuid: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      watchedSeconds: 2,
      device: 'tablet',
    });
    await record({ watchedSeconds: 9, device: 'desktop' });
    await record({ watchedSeconds: 9, device: 'mobile' });

    expect((await batch())?.devices).toEqual([
      { videoId: VIDEO, viewDate: '2026-03-10', device: 'desktop', views: 1 },
    ]);
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

  it.each([
    {
      scenario: 'a start of a test variant',
      event: { eventType: 'playback_start', experiment: SHOWN },
      starts: 1,
    },
    { scenario: 'a heartbeat of a test variant', event: { experiment: SHOWN }, starts: 0 },
    { scenario: 'a start outside any test', event: { eventType: 'playback_start' }, starts: 0 },
  ] as const)('counts $starts test start for $scenario', async ({ event, starts }) => {
    await record(event);

    expect((await batch())?.experiments.reduce((sum, row) => sum + row.starts, 0)).toBe(starts);
  });

  it('buffers one impression per card shown, for its variant and day', async () => {
    const other = { experimentId: '00000000-0000-7000-8000-0000000000e2', variantId: 'a' } as const;

    expectOk(
      await service.recordImpressions({
        items: [
          { ...SHOWN, videoId: VIDEO },
          { ...SHOWN, videoId: VIDEO },
          { ...other, videoId: VIDEO },
        ],
      })
    );

    expect((await batch())?.experiments).toEqual([
      expect.objectContaining({ ...SHOWN, viewDate: '2026-03-10', impressions: 2, starts: 0 }),
      expect.objectContaining({ ...other, viewDate: '2026-03-10', impressions: 1, starts: 0 }),
    ]);
  });

  it('accepts impressions the buffer cannot take', async () => {
    vi.spyOn(viewBuffer, 'recordExperimentEvents').mockResolvedValueOnce(
      err(cacheUnavailable('recordExperimentEvents'))
    );

    expect((await service.recordImpressions({ items: [{ ...SHOWN, videoId: VIDEO }] })).ok).toBe(
      true
    );
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

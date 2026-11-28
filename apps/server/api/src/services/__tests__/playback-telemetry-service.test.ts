import { err } from '@kit/result';
import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories, InMemoryViewBuffer } from '@vp/adapters/in-memory';
import type { PlaybackEvent } from '@vp/api-contracts';
import { cacheUnavailable } from '@vp/errors';
import { type PipelineMetrics, createPipelineMetrics } from '@vp/pipeline-metrics';
import { PlaybackTelemetryService } from '../playback-telemetry-service';
import { startTitleTest } from './running-test';

const VIDEO = '00000000-0000-7000-8000-0000000000a1';
const SESSION = '0f8fad5b-d9cb-469f-a165-70867728950e';
const NOW = Date.parse('2026-03-10T12:00:00.000Z');
const OTHER_VIDEO = '00000000-0000-7000-8000-0000000000a2';
const TEST = '00000000-0000-7000-8000-0000000000e1';
const OTHER_TEST = '00000000-0000-7000-8000-0000000000e2';
const LINK = '00000000-0000-7000-8000-0000000000c9';
const OTHER_LINK = '00000000-0000-7000-8000-0000000000ca';
const OWNER = '00000000-0000-7000-8000-0000000000b1';
const SHOWN = { experimentId: TEST, variantId: 'b' } as const;
const LIST = '00000000-0000-7000-8000-0000000000f1';

describe('PlaybackTelemetryService', () => {
  let viewBuffer: InMemoryViewBuffer;
  let metrics: PipelineMetrics;
  let service: PlaybackTelemetryService;

  beforeEach(async () => {
    const repositories = new InMemoryRepositories();
    const test = { ownerId: OWNER, control: 'A', challenger: 'B' };
    await startTitleTest(repositories, { ...test, videoId: VIDEO, id: TEST });
    await startTitleTest(repositories, { ...test, videoId: OTHER_VIDEO, id: OTHER_TEST });
    for (const [id, targetId] of [
      [LINK, VIDEO],
      [OTHER_LINK, OTHER_VIDEO],
    ] as const) {
      expectOk(
        await repositories.shareLinks.create(
          {
            id,
            targetType: 'video',
            targetId,
            token: id.replaceAll('-', '').padEnd(43, 'x'),
            label: null,
            expiresAt: null,
            createdBy: OWNER,
            revokedAt: null,
            createdAt: new Date(NOW - 1000),
          },
          50
        )
      );
    }
    viewBuffer = new InMemoryViewBuffer();
    metrics = createPipelineMetrics();
    service = new PlaybackTelemetryService({
      viewBuffer,
      experiments: repositories.videoExperiments,
      shareLinks: repositories.shareLinks,
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
    {
      scenario: "a start tagged with another video's test",
      event: { eventType: 'playback_start', experiment: { ...SHOWN, experimentId: OTHER_TEST } },
      starts: 0,
    },
  ] as const)('counts $starts test start for $scenario', async ({ event, starts }) => {
    await record(event);

    expect((await batch())?.experiments.reduce((sum, row) => sum + row.starts, 0)).toBe(starts);
  });

  it.each([
    {
      scenario: 'a start from a playlist',
      event: { eventType: 'playback_start', playlistId: LIST },
      plays: 1,
    },
    { scenario: 'a heartbeat from a playlist', event: { playlistId: LIST }, plays: 0 },
    { scenario: 'a start from no playlist', event: { eventType: 'playback_start' }, plays: 0 },
  ] as const)(
    'counts $plays playlist play for $scenario, to the video too',
    async ({ event, plays }) => {
      await record(event);

      expect((await batch())?.playlists ?? []).toEqual(
        plays === 0
          ? []
          : [
              expect.objectContaining({
                playlistId: LIST,
                videoId: VIDEO,
                viewDate: '2026-03-10',
                plays,
              }),
            ]
      );
    }
  );

  it('buffers one impression per card shown, only for the test running on that video', async () => {
    expectOk(
      await service.recordImpressions({
        items: [
          { ...SHOWN, videoId: VIDEO },
          { ...SHOWN, videoId: VIDEO },
          { experimentId: TEST, variantId: 'a', videoId: VIDEO },
          { experimentId: OTHER_TEST, variantId: 'a', videoId: VIDEO },
          { experimentId: TEST, variantId: 'c', videoId: VIDEO },
          { ...SHOWN, videoId: OTHER_VIDEO },
        ],
      })
    );

    expect((await batch())?.experiments).toEqual([
      expect.objectContaining({ ...SHOWN, viewDate: '2026-03-10', impressions: 2, starts: 0 }),
      expect.objectContaining({ experimentId: TEST, variantId: 'a', impressions: 1 }),
    ]);
  });

  it.each([
    { scenario: 'a link to this video', shareLinkId: LINK, kept: LINK },
    { scenario: 'a link to another video', shareLinkId: OTHER_LINK, kept: null },
    {
      scenario: 'a link nobody holds',
      shareLinkId: '00000000-0000-7000-8000-0000000000cb',
      kept: null,
    },
  ])('buffers the watch time of $scenario as $kept', async ({ shareLinkId, kept }) => {
    const recordPlayback = vi.spyOn(viewBuffer, 'recordPlayback');

    await record({ watchedSeconds: 9, shareLinkId });

    expect(recordPlayback).toHaveBeenCalledWith(expect.objectContaining({ shareLinkId: kept }));
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

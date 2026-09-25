import { InMemoryViewBuffer } from '@vp/adapters/in-memory';
import { cacheUnavailable } from '@vp/errors';
import { type PipelineMetrics, createMetricsRegistry } from '@vp/observability';
import type { UserContext } from '@vp/permissions';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { ViewService } from '../view-service';

const VIDEO = '00000000-0000-7000-8000-0000000000a1';
const SESSION = '0f8fad5b-d9cb-469f-a165-70867728950e';
const VIEWER: UserContext = { id: '00000000-0000-7000-8000-0000000000b1', role: 'USER' };
const NOW = Date.parse('2026-03-10T12:00:00.000Z');

describe('ViewService', () => {
  let viewBuffer: InMemoryViewBuffer;
  let metrics: PipelineMetrics;
  let service: ViewService;

  beforeEach(() => {
    viewBuffer = new InMemoryViewBuffer();
    metrics = createMetricsRegistry();
    service = new ViewService({
      viewBuffer,
      metrics,
      limits: { minWatchSeconds: 5 },
      now: () => NOW,
    });
  });

  const record = async (
    watchSeconds: number,
    viewer: UserContext | null = null,
    sessionId = SESSION
  ) =>
    expectOk(
      await service.record({
        videoId: VIDEO,
        viewer,
        telemetry: { sessionId, watchSeconds, videoDuration: 120 },
      })
    );

  const recorded = async (outcome: string) =>
    (await metrics.viewsRecorded.get()).values.find((value) => value.labels.outcome === outcome)
      ?.value ?? 0;

  const buffered = async () => expectOk(await viewBuffer.snapshot('batch'))?.counts ?? [];

  it("counts a qualifying view on today's date, with its watch time rounded", async () => {
    expect(await record(12.6)).toEqual({ videoId: VIDEO });

    expect(await buffered()).toEqual([
      { videoId: VIDEO, viewDate: '2026-03-10', views: 1, watchSeconds: 13 },
    ]);
    expect(await recorded('counted')).toBe(1);
  });

  it('accepts a beacon under the minimum watch time without counting it', async () => {
    expect(await record(4)).toEqual({ videoId: VIDEO });

    expect(await buffered()).toEqual([]);
    expect(await recorded('discarded')).toBe(1);
  });

  it('dedupes a signed-in viewer by account, whatever session the beacon names', async () => {
    await record(30, VIEWER, SESSION);
    await record(30, VIEWER, '7c9e6679-7425-40de-944b-e07fc1f90ae7');

    expect(await buffered()).toEqual([expect.objectContaining({ views: 1 })]);
    expect(await recorded('duplicate')).toBe(1);
  });

  it('dedupes an anonymous viewer by session', async () => {
    await record(30);
    await record(30, null, '7c9e6679-7425-40de-944b-e07fc1f90ae7');

    expect(await buffered()).toEqual([expect.objectContaining({ views: 2 })]);
  });

  it('accepts the beacon when the buffer cannot take it, and meters it as dropped', async () => {
    vi.spyOn(viewBuffer, 'record').mockResolvedValueOnce(err(cacheUnavailable('recordView')));

    expect(await record(30)).toEqual({ videoId: VIDEO });
    expect(await recorded('dropped')).toBe(1);
  });
});

import { Adapters, registerAdapters } from '@vp/adapters/composition';
import { Container } from '@vp/composition';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { Services, registerServices } from '../services.module';

describe('apps/server/api/composition: telemetry module', () => {
  it('records playback into the metrics and the view buffer the rest of the API shares', async () => {
    const c = registerServices(await registerAdapters(new Container(), inProcessAppConfig()));
    const videoId = '00000000-0000-7000-8000-00000000f301';

    expectOk(
      await c.get(Services.PlaybackTelemetryService).record({
        videoId,
        sessionUuid: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        eventType: 'playback_start',
        currentTime: 0,
        duration: 60,
        rebufferingMs: 0,
        watchedSeconds: 0,
      })
    );

    expect((await c.get(Adapters.Metrics).playbackStarts.get()).values[0]?.value).toBe(1);
    expect(expectOk(await c.get(Adapters.ViewBuffer).drainRetention())).toEqual([
      { videoId, percent: 0, viewers: 1 },
    ]);
  });
});

import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { SseHub, SseService } from '../services/index';
import { Services } from './service-tokens';

export function registerSseServices(c: Container): Container {
  const config = () => c.get(Adapters.Config);
  const repositories = () => c.get(Adapters.Repositories);

  return c
    .provide(
      Services.SseService,
      (c) =>
        new SseService({
          videos: repositories().videos,
          renditions: repositories().renditions,
          events: repositories().events,
          userEvents: repositories().userEvents,
          notifications: repositories().notifications,
          cdn: config().cdn,
          replayLimit: config().sse.replayLimit,
          logger: c.get(Services.Logger),
          liveStreams: repositories().liveStreams,
          liveViewers: (liveStreamId) => c.get(Services.LiveViewerTracker).viewers(liveStreamId),
        })
    )
    .provide(
      Services.SseHub,
      (c) =>
        new SseHub({
          cache: c.get(Adapters.Cache),
          metrics: c.get(Adapters.Metrics),
          maxConnectionsPerUser: config().sse.maxPerUser,
          maxPodConnections: config().sse.maxPerPod,
          heartbeatMs: config().sse.heartbeatMs,
          idleTimeoutMs: config().sse.idleTimeoutMs,
          maxPendingFrames: config().sse.maxPendingFrames,
          rememberedIds: config().sse.rememberedIds,
          logger: c.get(Services.Logger),
        }),
      { start: (hub) => hub.init(), dispose: (hub) => hub.close() }
    );
}

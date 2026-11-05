import { randomBytes } from 'node:crypto';
import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import {
  CreatorLiveService,
  LiveChatHub,
  LiveChatService,
  LiveCompanionService,
  LiveIngestService,
  LiveService,
  LiveViewerTracker,
} from '../services/index';
import { Poller } from '../services/poller';
import { Services } from './service-tokens';

/** A stream key is pasted into OBS, so it is URL-safe as well as unguessable. */
const newStreamSecret = () => randomBytes(24).toString('base64url');

export function registerLiveServices(c: Container): Container {
  const live = () => c.get(Adapters.Config).live;
  const repositories = () => c.get(Adapters.Repositories);
  const access = () => ({
    liveStreams: repositories().liveStreams,
    channels: repositories().channels,
    videos: repositories().videos,
  });

  return c
    .provide(
      Services.LiveIngestService,
      () =>
        new LiveIngestService({
          liveStreams: repositories().liveStreams,
          channels: repositories().channels,
          hookSecret: live().hookSecret,
          now: Date.now,
        })
    )
    .provide(
      Services.CreatorLiveService,
      (c) =>
        new CreatorLiveService({
          liveStreams: repositories().liveStreams,
          channels: repositories().channels,
          gateway: c.get(Adapters.LiveGateway),
          ingest: { rtmpPublicUrl: live().rtmpPublicUrl, whipPublicUrl: live().whipPublicUrl },
          newSecret: newStreamSecret,
          cache: c.get(Adapters.Cache),
          now: Date.now,
        })
    )
    .provide(
      Services.LiveViewerTracker,
      (c) =>
        new LiveViewerTracker({
          presence: c.get(Adapters.LivePresence),
          cache: c.get(Adapters.Cache),
          windowMs: live().chat.presenceWindowMs,
          now: Date.now,
          logger: c.get(Services.Logger),
        })
    )
    .provide(
      Services.LiveViewerHeartbeat,
      (c) => {
        const tracker = c.get(Services.LiveViewerTracker);
        return new Poller(() => tracker.beat(), live().chat.presenceHeartbeatMs);
      },
      { start: (poller) => poller.start(), dispose: (poller) => poller.stop() }
    )
    .provide(
      Services.LiveService,
      (c) =>
        new LiveService({
          ...access(),
          liveChat: repositories().liveChat,
          subscriptions: repositories().subscriptions,
          viewers: (liveStreamId) => c.get(Services.LiveViewerTracker).viewers(liveStreamId),
          cdn: c.get(Adapters.Config).cdn,
          limits: { list: live().chat.listLimit, replay: live().chat.replayLimit },
        })
    )
    .provide(
      Services.LiveChatHub,
      (c) => new LiveChatHub({ cache: c.get(Adapters.Cache), logger: c.get(Services.Logger) }),
      { start: (hub) => hub.init(), dispose: (hub) => hub.close() }
    )
    .provide(
      Services.LiveChatService,
      (c) =>
        new LiveChatService({
          ...access(),
          liveChat: repositories().liveChat,
          subscriptions: repositories().subscriptions,
          gate: c.get(Adapters.LiveChatGate),
          hub: c.get(Services.LiveChatHub),
          cache: c.get(Adapters.Cache),
          allowedOrigins: c.get(Adapters.Config).http.corsOrigins,
          tuning: live().chat,
          newTicket: newStreamSecret,
          now: Date.now,
        })
    )
    .provide(
      Services.LiveCompanionService,
      (c) =>
        new LiveCompanionService({
          liveStreams: repositories().liveStreams,
          gateway: c.get(Adapters.LiveGateway),
          cache: c.get(Adapters.Cache),
          now: Date.now,
        })
    );
}

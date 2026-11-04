import { randomBytes } from 'node:crypto';
import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { CreatorLiveService, LiveIngestService } from '../services/index';
import { Services } from './service-tokens';

/** A stream key is pasted into OBS, so it is URL-safe as well as unguessable. */
const newStreamSecret = () => randomBytes(24).toString('base64url');

export function registerLiveServices(c: Container): Container {
  const live = () => c.get(Adapters.Config).live;

  return c
    .provide(
      Services.LiveIngestService,
      (c) =>
        new LiveIngestService({
          liveStreams: c.get(Adapters.Repositories).liveStreams,
          channels: c.get(Adapters.Repositories).channels,
          hookSecret: live().hookSecret,
          now: Date.now,
        })
    )
    .provide(
      Services.CreatorLiveService,
      (c) =>
        new CreatorLiveService({
          liveStreams: c.get(Adapters.Repositories).liveStreams,
          channels: c.get(Adapters.Repositories).channels,
          gateway: c.get(Adapters.LiveGateway),
          ingest: { rtmpPublicUrl: live().rtmpPublicUrl, whipPublicUrl: live().whipPublicUrl },
          newSecret: newStreamSecret,
        })
    );
}

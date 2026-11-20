import type { Container } from '@kit/composition';
import { Adapters } from '@vp/adapters/composition';
import { uuidv7 } from 'uuidv7';
import {
  ExperimentOverlay,
  ShareLinkService,
  VideoAccessGate,
  VideoExperimentService,
  VideoPasswordService,
  VideoWatchService,
} from '../services/index';
import { Services } from './service-tokens';
import { videoAccessSecrets } from './video-access-secrets';

export function registerVideoAccessServices(c: Container): Container {
  const repositories = () => c.get(Adapters.Repositories);

  return c
    .provide(Services.VideoAccessSecrets, (c) =>
      videoAccessSecrets(c.get(Adapters.Config).videoAccess.secret)
    )
    .provide(
      Services.VideoAccessGate,
      (c) =>
        new VideoAccessGate({
          shareLinks: repositories().shareLinks,
          passwords: repositories().videoPasswords,
          unlock: c.get(Services.VideoAccessSecrets).unlock,
          now: Date.now,
        })
    )
    .provide(
      Services.ExperimentOverlay,
      () => new ExperimentOverlay(repositories().videoExperiments)
    )
    .provide(
      Services.VideoWatchService,
      (c) =>
        new VideoWatchService({
          videos: repositories().videos,
          videoService: c.get(Services.VideoService),
          gate: c.get(Services.VideoAccessGate),
          experiments: c.get(Services.ExperimentOverlay),
          viewBuffer: c.get(Adapters.ViewBuffer),
          now: Date.now,
        })
    )
    .provide(
      Services.ShareLinkService,
      (c) =>
        new ShareLinkService({
          videos: repositories().videos,
          shareLinks: repositories().shareLinks,
          newToken: c.get(Services.VideoAccessSecrets).newShareToken,
          newId: () => uuidv7(),
          now: Date.now,
        })
    )
    .provide(
      Services.VideoPasswordService,
      (c) =>
        new VideoPasswordService({
          videos: repositories().videos,
          passwords: repositories().videoPasswords,
          hasher: c.get(Adapters.PasswordHasher),
          unlock: c.get(Services.VideoAccessSecrets).unlock,
          now: Date.now,
        })
    )
    .provide(
      Services.VideoExperimentService,
      (c) =>
        new VideoExperimentService({
          videos: repositories().videos,
          experiments: repositories().videoExperiments,
          studio: c.get(Services.CreatorStudioService),
          newId: () => uuidv7(),
          now: Date.now,
        })
    );
}

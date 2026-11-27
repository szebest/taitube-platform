import type { Container } from '@kit/composition';
import { Singleflight } from '@kit/concurrency';
import { Adapters } from '@vp/adapters/composition';
import { ChannelLayoutService, ChannelPageResolver, ChannelPageService } from '../services/index';
import { Services } from './service-tokens';

export function registerChannelPageServices(c: Container): Container {
  const repositories = () => c.get(Adapters.Repositories);

  return c
    .provide(
      Services.ChannelLayoutService,
      (c) =>
        new ChannelLayoutService({
          layouts: repositories().channelLayouts,
          schedules: repositories().channelLayoutSchedules,
          revisions: repositories().entityRevisions,
          sources: repositories().channelPageSources,
          paginator: c.get(Services.Paginator),
          now: Date.now,
        })
    )
    .provide(
      Services.ChannelPageResolver,
      (c) =>
        new ChannelPageResolver({
          sources: repositories().channelPageSources,
          history: repositories().watchHistory,
          cache: c.get(Adapters.Cache),
          singleflight: new Singleflight(),
          cdn: c.get(Adapters.Config).cdn,
          now: Date.now,
        })
    )
    .provide(
      Services.ChannelPageService,
      (c) =>
        new ChannelPageService({
          channels: repositories().channels,
          layouts: repositories().channelLayouts,
          subscriptions: repositories().subscriptions,
          resolver: c.get(Services.ChannelPageResolver),
        })
    );
}

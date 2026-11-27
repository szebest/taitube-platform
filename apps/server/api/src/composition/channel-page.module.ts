import type { Container } from '@kit/composition';
import { Singleflight } from '@kit/concurrency';
import { Adapters } from '@vp/adapters/composition';
import {
  ChannelLayoutScheduleService,
  ChannelLayoutService,
  ChannelPageResolver,
  ChannelPageService,
} from '../services/index';
import { Services } from './service-tokens';

export function registerChannelPageServices(c: Container): Container {
  const repositories = () => c.get(Adapters.Repositories);

  return c
    .provide(
      Services.ChannelLayoutService,
      (c) =>
        new ChannelLayoutService({
          layouts: repositories().channelLayouts,
          revisions: repositories().entityRevisions,
          sources: repositories().channelPageSources,
          images: repositories().channelImages,
          paginator: c.get(Services.Paginator),
        })
    )
    .provide(
      Services.ChannelLayoutScheduleService,
      () =>
        new ChannelLayoutScheduleService({
          layouts: repositories().channelLayouts,
          schedules: repositories().channelLayoutSchedules,
          sources: repositories().channelPageSources,
          images: repositories().channelImages,
          now: Date.now,
        })
    )
    .provide(
      Services.ChannelPageResolver,
      (c) =>
        new ChannelPageResolver({
          sources: repositories().channelPageSources,
          images: repositories().channelImages,
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

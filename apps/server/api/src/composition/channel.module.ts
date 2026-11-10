import { Adapters, queueNamed } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { SUPPORTED_LOCALES } from '@vp/intl';
import {
  ChannelFeaturedService,
  ChannelIdentityService,
  ChannelImagePipelineService,
  ChannelSpotlightService,
  ChannelService,
  RequestIdentity,
} from '../services/index';
import { Services } from './service-tokens';
import { registerTeamServices } from './team.module';

export function registerChannelServices(c: Container): Container {
  return registerTeamServices(c)
    .provide(
      Services.ChannelIdentityService,
      (c) =>
        new ChannelIdentityService({
          channels: c.get(Adapters.Repositories).channels,
          handleHistory: c.get(Adapters.Repositories).channelHandleHistory,
          audit: c.get(Adapters.Repositories).channelAudit,
          now: Date.now,
        })
    )
    .provide(
      Services.ChannelImagePipelineService,
      (c) =>
        new ChannelImagePipelineService({
          channels: c.get(Adapters.Repositories).channels,
          images: c.get(Adapters.Repositories).channelImages,
          storage: c.get(Adapters.Storage),
          rawBucket: c.get(Adapters.Config).buckets.raw,
          presignedUrlTtlSeconds: c.get(Adapters.Config).limits.presignTtlSeconds,
          queue: queueNamed(c.get(Adapters.Queues), 'thumbnail'),
        })
    )
    .provide(
      Services.ChannelSpotlightService,
      (c) =>
        new ChannelSpotlightService({
          channels: c.get(Adapters.Repositories).channels,
          pages: c.get(Adapters.Repositories).channelPages,
          videos: c.get(Adapters.Repositories).videos,
          subscriptions: c.get(Adapters.Repositories).subscriptions,
          audit: c.get(Adapters.Repositories).channelAudit,
          identity: c.get(Services.ChannelIdentityService),
          videoService: c.get(Services.VideoService),
          locales: SUPPORTED_LOCALES,
        })
    )
    .provide(
      Services.ChannelService,
      (c) =>
        new ChannelService({
          users: c.get(Adapters.Repositories).users,
          channels: c.get(Adapters.Repositories).channels,
          captions: c.get(Adapters.Repositories).captions,
          liveStreams: c.get(Adapters.Repositories).liveStreams,
          playlists: c.get(Adapters.Repositories).playlists,
          videoService: c.get(Services.VideoService),
          paginator: c.get(Services.Paginator),
          cdn: c.get(Adapters.Config).cdn,
          identity: c.get(Services.ChannelIdentityService),
          pages: c.get(Adapters.Repositories).channelPages,
          now: Date.now,
        })
    )
    .provide(
      Services.RequestIdentity,
      (c) =>
        new RequestIdentity({
          channels: c.get(Services.ChannelService),
          members: c.get(Adapters.Repositories).channelMembers,
        })
    )
    .provide(
      Services.ChannelFeaturedService,
      (c) =>
        new ChannelFeaturedService({
          channels: c.get(Adapters.Repositories).channels,
          featured: c.get(Adapters.Repositories).channelFeatured,
          videos: c.get(Adapters.Repositories).videos,
          videoService: c.get(Services.VideoService),
        })
    );
}

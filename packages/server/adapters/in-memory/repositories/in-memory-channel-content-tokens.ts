import { token } from '@kit/di';
import type { InMemoryChannelFeaturedRepository } from './in-memory-channel-featured-repository';
import type { InMemoryChannelHandleHistoryRepository } from './in-memory-channel-handle-history-repository';
import type { InMemoryChannelImageRepository } from './in-memory-channel-image-repository';
import type { InMemoryChannelLayoutRepository } from './in-memory-channel-layout-repository';
import type { InMemoryChannelLayoutScheduleRepository } from './in-memory-channel-layout-schedule-repository';
import type { InMemoryChannelPageRepository } from './in-memory-channel-page-repository';
import type { InMemoryChannelPageSources } from './in-memory-channel-page-sources';
import type { InMemoryChannelPostRepository } from './in-memory-channel-post-repository';
import type { InMemoryPostEngagement } from './in-memory-post-engagement-repository';

export const ChannelContentRepo = {
  channelFeatured: token<InMemoryChannelFeaturedRepository>('channelFeatured'),
  channelHandleHistory: token<InMemoryChannelHandleHistoryRepository>('channelHandleHistory'),
  channelImages: token<InMemoryChannelImageRepository>('channelImages'),
  channelPages: token<InMemoryChannelPageRepository>('channelPages'),
  channelLayouts: token<InMemoryChannelLayoutRepository>('channelLayouts'),
  channelLayoutSchedules: token<InMemoryChannelLayoutScheduleRepository>('channelLayoutSchedules'),
  channelPageSources: token<InMemoryChannelPageSources>('channelPageSources'),
  channelPosts: token<InMemoryChannelPostRepository>('channelPosts'),
  postEngagement: token<InMemoryPostEngagement>('postEngagement'),
} as const;

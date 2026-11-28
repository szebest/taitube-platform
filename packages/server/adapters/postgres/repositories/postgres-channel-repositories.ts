import { PostgresChannelAuditRepository } from './postgres-channel-audit-repository';
import { PostgresChannelFeaturedRepository } from './postgres-channel-featured-repository';
import { PostgresChannelHandleHistoryRepository } from './postgres-channel-handle-history-repository';
import { PostgresChannelImageRepository } from './postgres-channel-image-repository';
import { PostgresChannelInviteRepository } from './postgres-channel-invite-repository';
import { PostgresChannelLayoutRepository } from './postgres-channel-layout-repository';
import { PostgresChannelLayoutScheduleRepository } from './postgres-channel-layout-schedule-repository';
import { PostgresChannelMemberRepository } from './postgres-channel-member-repository';
import { PostgresChannelPageRepository } from './postgres-channel-page-repository';
import { PostgresChannelPageSourceRepository } from './postgres-channel-page-source-repository';
import { PostgresChannelPostRepository } from './postgres-channel-post-repository';
import { PostgresChannelRepository } from './postgres-channel-repository';
import { PostgresPostEngagementRepository } from './postgres-post-engagement-repository';
import { PostgresVideoThreadRepository } from './postgres-video-thread-repository';
import type { PostgresDatabase } from './types';

export function createChannelRepositories(db: PostgresDatabase) {
  return {
    channels: new PostgresChannelRepository(db),
    channelMembers: new PostgresChannelMemberRepository(db),
    channelInvites: new PostgresChannelInviteRepository(db),
    channelAudit: new PostgresChannelAuditRepository(db),
    channelFeatured: new PostgresChannelFeaturedRepository(db),
    channelHandleHistory: new PostgresChannelHandleHistoryRepository(db),
    channelImages: new PostgresChannelImageRepository(db),
    channelPages: new PostgresChannelPageRepository(db),
    channelLayouts: new PostgresChannelLayoutRepository(db),
    channelLayoutSchedules: new PostgresChannelLayoutScheduleRepository(db),
    channelPageSources: new PostgresChannelPageSourceRepository(db),
    channelPosts: new PostgresChannelPostRepository(db),
    postEngagement: new PostgresPostEngagementRepository(db),
    videoThreads: new PostgresVideoThreadRepository(db),
  };
}

export type ChannelRepositories = ReturnType<typeof createChannelRepositories>;

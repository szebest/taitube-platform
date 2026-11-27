import { PostgresChannelAuditRepository } from './postgres-channel-audit-repository';
import { PostgresChannelFeaturedRepository } from './postgres-channel-featured-repository';
import { PostgresChannelHandleHistoryRepository } from './postgres-channel-handle-history-repository';
import { PostgresChannelImageRepository } from './postgres-channel-image-repository';
import { PostgresChannelInviteRepository } from './postgres-channel-invite-repository';
import { PostgresChannelMemberRepository } from './postgres-channel-member-repository';
import { PostgresChannelPageRepository } from './postgres-channel-page-repository';
import { PostgresChannelPostRepository } from './postgres-channel-post-repository';
import { PostgresChannelRepository } from './postgres-channel-repository';
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
    channelPosts: new PostgresChannelPostRepository(db),
  };
}

export type ChannelRepositories = ReturnType<typeof createChannelRepositories>;

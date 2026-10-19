import { channels, videos } from '@vp/db';
import type { Channel } from '@vp/domain';
import { eq, getTableColumns, sql } from 'drizzle-orm';
import { drizzleWhere } from '../scopes/index';
import { publicFeedScope } from './public-feed-query';

const publicOwnedVideos = drizzleWhere(publicFeedScope(), eq(videos.ownerId, channels.userId));

/**
 * The channel and, in the same statement, what the public feed shows of its owner's videos: the
 * rule for which videos count is the feed's own scope, so the two can never disagree.
 */
export const channelColumns = {
  ...getTableColumns(channels),
  videoCount: sql<number>`(select count(*) from ${videos} where ${publicOwnedVideos})`.mapWith(
    Number
  ),
  totalViews:
    sql<number>`(select coalesce(sum(${videos.viewsCount}), 0) from ${videos} where ${publicOwnedVideos})`.mapWith(
      Number
    ),
};

export function toChannel(
  row: typeof channels.$inferSelect & Pick<Channel, 'videoCount' | 'totalViews'>
): Channel {
  return {
    id: row.id,
    userId: row.userId,
    handle: row.handle,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    bannerUrl: row.bannerUrl,
    bio: row.bio,
    links: row.links,
    subscriberCount: row.subscriberCount,
    videoCount: row.videoCount,
    totalViews: row.totalViews,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

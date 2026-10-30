import type { Channel, VideoSummary } from '@vp/api-contracts';

import { videoItemList } from './json-ld';
import { pageHead } from './page-head';

export function channelHead(channel: Channel, videos: VideoSummary[], siteUrl: string) {
  return pageHead({
    siteUrl,
    path: `/channel/${channel.id}`,
    title: channel.displayName,
    description: channel.bio || `Videos by ${channel.displayName} on Taitube.`,
    image: channel.avatarUrl ?? undefined,
    openGraphType: 'profile',
    jsonLd: videoItemList(videos, siteUrl),
  });
}

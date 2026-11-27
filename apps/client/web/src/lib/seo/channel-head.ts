import type { Channel, VideoSummary } from '@vp/api-contracts';
import type { HeadWords } from './head-words';
import { videoItemList } from './json-ld';
import { pageHead } from './page-head';

export function channelHead(
  channel: Channel,
  videos: VideoSummary[],
  siteUrl: string,
  { locale, tOr }: HeadWords
) {
  return pageHead({
    siteUrl,
    locale,
    path: `/@${channel.handle}`,
    title: channel.displayName,
    description: channel.bio || tOr('shell.channelDescription', { name: channel.displayName }, ''),
    image: channel.avatarUrl ?? undefined,
    openGraphType: 'profile',
    jsonLd: videoItemList(videos, siteUrl),
  });
}

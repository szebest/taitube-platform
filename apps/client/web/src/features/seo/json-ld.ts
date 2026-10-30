import type { Video, VideoSummary } from '@vp/api-contracts';

import { channelUrl, videoUrl } from './urls';

type JsonLd = Record<string, unknown>;

type VideoFacts = Pick<
  Video,
  'id' | 'title' | 'description' | 'durationMs' | 'readyAt' | 'createdAt'
> &
  Partial<Pick<Video, 'thumbnailUrl' | 'posterUrl' | 'playbackUrl' | 'viewsCount' | 'likesCount'>> &
  Partial<Pick<VideoSummary, 'channel'>>;

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/** `PT1H2M3S`, the ISO 8601 duration schema.org asks for; whole seconds. */
export function isoDuration(durationMs: number): string {
  const total = Math.round(durationMs / MS_PER_SECOND);
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = total % SECONDS_PER_MINUTE;
  const parts = [
    [hours, 'H'],
    [minutes, 'M'],
    [seconds, 'S'],
  ]
    .filter(([amount]) => amount !== 0)
    .map(([amount, unit]) => `${amount}${unit}`);
  return `PT${parts.join('') || '0S'}`;
}

function interaction(type: 'WatchAction' | 'LikeAction', count: number): JsonLd {
  return {
    '@type': 'InteractionCounter',
    interactionType: { '@type': type },
    userInteractionCount: count,
  };
}

export function videoObject(
  video: VideoFacts,
  siteUrl: string,
  { standalone = false } = {}
): JsonLd {
  const thumbnail = video.thumbnailUrl ?? video.posterUrl;
  const statistics = [
    video.viewsCount === undefined ? null : interaction('WatchAction', video.viewsCount),
    video.likesCount === undefined ? null : interaction('LikeAction', video.likesCount),
  ].filter((entry) => entry !== null);

  return {
    ...(standalone && { '@context': 'https://schema.org' }),
    '@type': 'VideoObject',
    name: video.title ?? 'Untitled',
    description: video.description || video.title || 'Untitled',
    url: videoUrl(siteUrl, video.id),
    uploadDate: video.readyAt ?? video.createdAt,
    ...(thumbnail && { thumbnailUrl: [thumbnail] }),
    ...(video.durationMs !== undefined && { duration: isoDuration(video.durationMs) }),
    ...(video.playbackUrl && { contentUrl: video.playbackUrl }),
    ...(statistics.length > 0 && { interactionStatistic: statistics }),
    ...(video.channel && {
      author: {
        '@type': 'Person',
        name: video.channel.displayName,
        url: channelUrl(siteUrl, video.channel.id),
      },
    }),
  };
}

export function videoItemList(videos: VideoFacts[], siteUrl: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: videos.map((video, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: videoObject(video, siteUrl),
    })),
  };
}

/** Script content: `<` is escaped so a title can never close the tag around it. */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replaceAll('<', '\\u003c');
}

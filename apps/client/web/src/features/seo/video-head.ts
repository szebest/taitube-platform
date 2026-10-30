import type { Video } from '@vp/api-contracts';

import { videoObject } from './json-ld';
import { pageHead } from './page-head';

const HLS_MIME = 'application/x-mpegURL';
const DEFAULT_PLAYER_SIZE = { width: 1280, height: 720 };

export function videoHead(video: Video, siteUrl: string) {
  const title = video.title ?? 'Untitled';
  const path = `/watch/${video.id}`;
  const { width, height } = video.width && video.height ? video : DEFAULT_PLAYER_SIZE;
  const image = video.thumbnailUrl ?? video.posterUrl;

  return pageHead({
    siteUrl,
    path,
    title,
    description: video.description || title,
    image,
    openGraphType: 'video.other',
    twitterCard: 'player',
    jsonLd: videoObject(video, siteUrl, { standalone: true }),
    extraMeta: [
      ...(video.playbackUrl
        ? [
            { property: 'og:video', content: video.playbackUrl },
            { property: 'og:video:type', content: HLS_MIME },
            { property: 'og:video:width', content: String(width) },
            { property: 'og:video:height', content: String(height) },
          ]
        : []),
      { name: 'twitter:player', content: `${siteUrl}${path}` },
      { name: 'twitter:player:width', content: String(width) },
      { name: 'twitter:player:height', content: String(height) },
    ],
  });
}

import type { Video } from '@vp/api-contracts';

import { videoObject } from './json-ld';
import { pageHead } from './page-head';
import { embedUrl, oembedUrl } from './urls';

const DEFAULT_PLAYER_SIZE = { width: 1280, height: 720 };

export function videoHead(video: Video, siteUrl: string) {
  const title = video.title ?? 'Untitled';
  if (video.visibility !== 'public' || video.status !== 'READY')
    return { meta: [{ title }], links: [], scripts: [] };

  const path = `/watch/${video.id}`;
  const embed = embedUrl(siteUrl, video.id);
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
    extraLinks: [
      {
        rel: 'alternate',
        type: 'application/json+oembed',
        href: oembedUrl(siteUrl, video.id),
        title,
      },
    ],
    extraMeta: [
      { property: 'og:video', content: embed },
      { property: 'og:video:url', content: embed },
      { property: 'og:video:secure_url', content: embed },
      { property: 'og:video:type', content: 'text/html' },
      { property: 'og:video:width', content: String(width) },
      { property: 'og:video:height', content: String(height) },
      { name: 'twitter:player', content: embed },
      { name: 'twitter:player:width', content: String(width) },
      { name: 'twitter:player:height', content: String(height) },
    ],
  });
}

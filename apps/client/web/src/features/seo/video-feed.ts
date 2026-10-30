import type { ApiClient } from '@vp/api-client';

import { listPublicVideos } from './public-videos';
import { videoUrl } from './urls';
import { element, xmlResponse } from './xml';

const FEED_ITEMS = 50;

export async function videoFeedResponse(api: ApiClient, siteUrl: string): Promise<Response> {
  const videos = await listPublicVideos(api, FEED_ITEMS);
  const items = videos.map((video) => {
    const url = videoUrl(siteUrl, video.id);
    return `<item>${element('title', video.title ?? 'Untitled')}${element('link', url)}<guid isPermaLink="true">${url}</guid>${element('pubDate', new Date(video.readyAt ?? video.createdAt).toUTCString())}${element('description', video.description ?? '')}</item>`;
  });

  return xmlResponse(
    `<rss version="2.0"><channel>${element('title', 'Taitube')}${element('link', siteUrl)}${element('description', 'The newest public videos on Taitube')}${items.join('')}</channel></rss>`,
    'application/rss+xml'
  );
}

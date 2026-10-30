import type { ApiClient } from '@vp/api-client';

import { listPublicVideos } from './public-videos';
import { videoUrl } from './urls';
import { element, xmlResponse } from './xml';

const SITEMAP_URLS = 5000;

export async function sitemapResponse(api: ApiClient, siteUrl: string): Promise<Response> {
  const videos = await listPublicVideos(api, SITEMAP_URLS);
  const urls = videos.map(
    (video) =>
      `<url>${element('loc', videoUrl(siteUrl, video.id))}${element('lastmod', video.updatedAt)}</url>`
  );

  return xmlResponse(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,
    'application/xml'
  );
}

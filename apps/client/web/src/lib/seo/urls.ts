import { API_PROXY_PATH } from '@vp/queries';

export function videoUrl(siteUrl: string, videoId: string): string {
  return `${siteUrl}/watch/${videoId}`;
}

export function channelUrl(siteUrl: string, channelId: string): string {
  return `${siteUrl}/channel/${channelId}`;
}

export function embedUrl(siteUrl: string, videoId: string): string {
  return `${siteUrl}/embed/${videoId}`;
}

/** The oEmbed endpoint for a watch page, on this app's own origin: its `/api` proxy answers anonymous GETs. */
export function oembedUrl(siteUrl: string, videoId: string): string {
  const query = new URLSearchParams({ url: videoUrl(siteUrl, videoId), format: 'json' });
  return `${siteUrl}${API_PROXY_PATH}/v1/oembed?${query}`;
}

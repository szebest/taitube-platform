export function videoUrl(siteUrl: string, videoId: string): string {
  return `${siteUrl}/watch/${videoId}`;
}

export function channelUrl(siteUrl: string, channelId: string): string {
  return `${siteUrl}/channel/${channelId}`;
}

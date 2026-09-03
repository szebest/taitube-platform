export function videoChannel(videoId: string): string {
  return `video:${videoId}`;
}

export function userChannel(userId: string): string {
  return `user:${userId}`;
}

export const VIDEO_WILDCARD_CHANNEL = 'video:*';

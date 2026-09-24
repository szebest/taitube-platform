const VIDEO_PREFIX = 'video:';
const USER_PREFIX = 'user:';

export type ChannelType = 'video' | 'user';

export function videoChannel(videoId: string): string {
  return `${VIDEO_PREFIX}${videoId}`;
}

export function userChannel(userId: string): string {
  return `${USER_PREFIX}${userId}`;
}

export const VIDEO_WILDCARD_CHANNEL = `${VIDEO_PREFIX}*`;
export const USER_WILDCARD_CHANNEL = `${USER_PREFIX}*`;

export function channelType(channel: string): ChannelType {
  return channel.startsWith(VIDEO_PREFIX) ? 'video' : 'user';
}

const VIDEO_PREFIX = 'video:';
const USER_PREFIX = 'user:';
const LIVE_CHAT_PREFIX = 'live-chat:';

export type ChannelType = 'video' | 'user';

export function videoChannel(videoId: string): string {
  return `${VIDEO_PREFIX}${videoId}`;
}

export function userChannel(userId: string): string {
  return `${USER_PREFIX}${userId}`;
}

/** A stream's chat lines and moderation, fanned out to the sockets on every pod. */
export function liveChatChannel(liveStreamId: string): string {
  return `${LIVE_CHAT_PREFIX}${liveStreamId}`;
}

export function liveStreamIdOfChat(channel: string): string | null {
  return channel.startsWith(LIVE_CHAT_PREFIX) ? channel.slice(LIVE_CHAT_PREFIX.length) : null;
}

export const LIVE_CHAT_WILDCARD_CHANNEL = `${LIVE_CHAT_PREFIX}*`;
export const VIDEO_WILDCARD_CHANNEL = `${VIDEO_PREFIX}*`;
export const USER_WILDCARD_CHANNEL = `${USER_PREFIX}*`;

export function channelType(channel: string): ChannelType {
  return channel.startsWith(VIDEO_PREFIX) ? 'video' : 'user';
}

import type { Account, Channel, SubscribedChannel, Video, VideoSummary } from '@vp/api-contracts';

export const VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a001';
export const OWNER_ID = '0190c3a0-5e1d-7000-8000-00000000b001';
export const CHANNEL_ID = '0190c3a0-5e1d-7000-8000-00000000c001';

const CREATED_AT = '2026-01-01T00:00:00.000Z';

export function videoSummary(overrides: Partial<VideoSummary> = {}): VideoSummary {
  return {
    id: VIDEO_ID,
    ownerId: OWNER_ID,
    title: 'A video',
    description: 'About something',
    visibility: 'public',
    status: 'READY',
    viewsCount: 12,
    version: 0,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

export function video(overrides: Partial<Video> = {}): Video {
  return {
    id: VIDEO_ID,
    ownerId: OWNER_ID,
    title: 'A video',
    description: 'About something',
    visibility: 'public',
    status: 'READY',
    progress: { overall: 100, byRendition: {} },
    renditions: [],
    likesCount: 0,
    dislikesCount: 0,
    version: 3,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

export function channel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: CHANNEL_ID,
    userId: OWNER_ID,
    handle: 'creator',
    displayName: 'The Creator',
    avatarUrl: null,
    bannerUrl: null,
    bio: null,
    subscriberCount: 0,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

export function subscribedChannel(overrides: Partial<SubscribedChannel> = {}): SubscribedChannel {
  return { ...channel(), subscribedAt: CREATED_AT, ...overrides };
}

export function account(): Account {
  const user = { id: OWNER_ID, email: 'creator@example.com', tier: 'free', createdAt: CREATED_AT };
  return { ...user, user, channel: channel() };
}

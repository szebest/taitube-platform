import type {
  Account,
  Channel,
  ClipView,
  CurrentPickView,
  SubscribedChannel,
  Video,
  VideoSummary,
} from '@vp/api-contracts';

export const VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a001';
export const OWNER_ID = '0190c3a0-5e1d-7000-8000-00000000b001';
export const CHANNEL_ID = '0190c3a0-5e1d-7000-8000-00000000c001';
export const CLIP_ID = '0190c3a0-5e1d-7000-8000-00000000d001';

const CREATED_AT = '2026-01-01T00:00:00.000Z';

export function videoSummary(overrides: Partial<VideoSummary> = {}): VideoSummary {
  const { id, handle, displayName, avatarUrl } = channel();
  return {
    id: VIDEO_ID,
    ownerId: OWNER_ID,
    title: 'A video',
    description: 'About something',
    visibility: 'public',
    status: 'READY',
    format: 'standard',
    viewsCount: 12,
    channel: { id, handle, displayName, avatarUrl },
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
    format: 'standard',
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

/** A pick nobody scheduled: the top trending video, with no note and no window. */
export function fallbackPick(overrides: Partial<CurrentPickView> = {}): CurrentPickView {
  return {
    source: 'fallback',
    video: videoSummary(),
    note: null,
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

/** A pick an editor scheduled, with its note and the window that holds `startsAt` to `endsAt`. */
export function scheduledPick(
  window: { startsAt: string; endsAt: string },
  overrides: Partial<CurrentPickView> = {}
): CurrentPickView {
  return {
    source: 'scheduled',
    video: videoSummary(),
    note: 'Eighteen minutes of trams and wet tiles.',
    ...window,
    ...overrides,
  };
}

/** A clip of ten seconds starting at 0:20, of a video two minutes long. */
export function clip(overrides: Partial<ClipView> = {}): ClipView {
  return {
    id: CLIP_ID,
    videoId: VIDEO_ID,
    userId: OWNER_ID,
    startMs: 20_000,
    endMs: 30_000,
    title: 'The best part',
    createdAt: CREATED_AT,
    video: videoSummary({
      durationMs: 120_000,
      playbackUrl: 'http://localhost:9000/hls/master.m3u8',
    }),
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
    links: [],
    subscriberCount: 0,
    videoCount: 0,
    totalViews: 0,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

export function subscribedChannel(overrides: Partial<SubscribedChannel> = {}): SubscribedChannel {
  return { ...channel(), subscribedAt: CREATED_AT, notificationLevel: 'all', ...overrides };
}

/** One page of a keyset feed, as an infinite query caches it after the loader's first fetch. */
export function feedPages(items: VideoSummary[]) {
  return { pages: [{ items, nextCursor: null, total: items.length }], pageParams: [undefined] };
}

export function account(overrides: Partial<Account> = {}): Account {
  const user = { id: OWNER_ID, email: 'creator@example.com', tier: 'free', createdAt: CREATED_AT };
  return { ...user, role: 'CREATOR', user, channel: channel(), ...overrides };
}

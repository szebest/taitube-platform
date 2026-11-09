import type {
  Account,
  CaptionTrackView,
  ClipView,
  CommentView,
  CreatorInboxCommentView,
  CurrentPickView,
  LiveChatMessageView,
  LiveChatServerFrame,
  LiveStreamPublicView,
  WatchPartyServerFrame,
  WatchPartyView,
  OwnerChannel,
  SubscribedChannel,
  TranscriptView,
  Video,
  VideoSummary,
} from '@vp/api-contracts';

export const VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a001';
export const OWNER_ID = '0190c3a0-5e1d-7000-8000-00000000b001';
export const CHANNEL_ID = '0190c3a0-5e1d-7000-8000-00000000c001';
export const CLIP_ID = '0190c3a0-5e1d-7000-8000-00000000d001';
export const CAPTION_ID = '0190c3a0-5e1d-7000-8000-00000000f001';
export const COMMENT_ID = '0190c3a0-5e1d-7000-8000-00000000d001';
export const COMMENT_AUTHOR_ID = '0190c3a0-5e1d-7000-8000-00000000b002';

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

/** A top-level comment by a viewer other than the video's owner. */
export function comment(overrides: Partial<CommentView> = {}): CommentView {
  const postedAt = '2026-10-14T09:12:00.000Z';
  return {
    id: COMMENT_ID,
    videoId: VIDEO_ID,
    parentId: null,
    content: 'The tram at 02:15 is the best sound design this year.',
    isPinned: false,
    isEdited: false,
    likeCount: 0,
    heartedByCreator: false,
    replyCount: 0,
    author: {
      userId: COMMENT_AUTHOR_ID,
      channelId: null,
      handle: 'ines',
      displayName: 'Ines Carvalho',
      avatarUrl: null,
      isCreator: false,
    },
    createdAt: postedAt,
    updatedAt: postedAt,
    ...overrides,
  };
}

/** The same comment as the creator's inbox lists it, with the video it is on. */
export function inboxComment(
  overrides: Partial<CreatorInboxCommentView> = {}
): CreatorInboxCommentView {
  return { ...comment(), video: { id: VIDEO_ID, title: 'Alfama at 5 a.m.' }, ...overrides };
}

export function channel(overrides: Partial<OwnerChannel> = {}): OwnerChannel {
  return {
    id: CHANNEL_ID,
    userId: OWNER_ID,
    handle: 'creator',
    displayName: 'The Creator',
    avatarUrl: null,
    bannerUrl: null,
    brandColor: null,
    bio: null,
    links: [],
    subscriberCount: 0,
    videoCount: 0,
    totalViews: 0,
    live: null,
    autoCaptionsDefault: false,
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

export const LIVE_STREAM_ID = '0190c3a0-5e1d-7000-8000-00000000e001';
export const LIVE_VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000e002';

/** A public broadcast live now, as `GET /v1/live/:id` returns it. */
export function liveStream(overrides: Partial<LiveStreamPublicView> = {}): LiveStreamPublicView {
  return {
    id: LIVE_STREAM_ID,
    status: 'LIVE',
    title: 'Lisbon trams at dusk',
    description: '',
    channel: { id: CHANNEL_ID, handle: 'creator', displayName: 'The Creator', avatarUrl: null },
    videoId: LIVE_VIDEO_ID,
    startedAt: '2026-11-05T10:00:00.000Z',
    endedAt: null,
    viewers: 41,
    playbackUrl: `http://localhost:9000/public/live/${LIVE_STREAM_ID}/master.m3u8`,
    chat: { slowModeSeconds: 0, subscribersOnly: false },
    ...overrides,
  };
}

const AUTHOR_ID = '0190c3a0-5e1d-7000-8000-00000000e0a1';
const MESSAGE_ID_PREFIX = '0190c3a0-5e1d-7000-8000-00000000f';

export const chatMessageId = (index: number) =>
  `${MESSAGE_ID_PREFIX}${String(index).padStart(3, '0')}`;

/** Chat line `index`, posted `index` seconds into the broadcast. */
export function chatMessage(
  index: number,
  message: string,
  displayName: string | null = 'Mira'
): LiveChatMessageView {
  return {
    id: chatMessageId(index),
    author: { userId: AUTHOR_ID, handle: 'mira', displayName, avatarUrl: null },
    message,
    offsetMs: index * 1000,
    createdAt: '2026-11-05T10:00:00.000Z',
  };
}

export const chatLine = (
  index: number,
  message: string,
  displayName?: string | null
): LiveChatServerFrame => ({
  type: 'message',
  message: chatMessage(index, message, displayName),
});

export const chatRemoved = (index: number): LiveChatServerFrame => ({
  type: 'removed',
  id: chatMessageId(index),
});

export function captionTrack(overrides: Partial<CaptionTrackView> = {}): CaptionTrackView {
  return {
    id: CAPTION_ID,
    language: 'en',
    kind: 'auto',
    status: 'ready',
    url: `http://localhost:9000/public/captions/${VIDEO_ID}/en.vtt`,
    ...overrides,
  };
}

export function transcript(overrides: Partial<TranscriptView> = {}): TranscriptView {
  return {
    captionId: CAPTION_ID,
    language: 'en',
    kind: 'auto',
    cues: [
      { index: 0, startMs: 0, endMs: 2000, text: 'Hello and welcome' },
      { index: 1, startMs: 2000, endMs: 5000, text: 'Today we bake bread' },
      { index: 2, startMs: 5000, endMs: 9000, text: 'First the flour' },
    ],
    ...overrides,
  };
}

const partyId = (index: number) => `0190c3a0-5e1d-7000-8000-${String(index).padStart(12, '0')}`;

export const PARTY_ID = partyId(0x9001);
export const PARTY_VIEWER_KEY = `user:${partyId(0x9101)}`;
export const PARTY_OWNER_KEY = `user:${partyId(0x9102)}`;
const PARTY_ITEM_ID = partyId(0x9201);

export function partyRoom(overrides: Partial<WatchPartyView> = {}): WatchPartyView {
  return {
    id: PARTY_ID,
    name: 'Movie night',
    owner: { memberKey: PARTY_OWNER_KEY, name: 'Ana', avatarUrl: null },
    asChannelId: null,
    visibility: 'unlisted',
    hasPassword: false,
    capacity: null,
    effectiveCapacity: 200,
    allowGuests: true,
    chatEnabled: true,
    slowModeSeconds: 0,
    bufferPolicy: 'wait',
    autoplay: true,
    skipVotePercent: 50,
    idleClose: '15m',
    language: null,
    accent: null,
    scheduledFor: null,
    autoStart: false,
    phase: 'lobby',
    currentVideo: {
      id: VIDEO_ID,
      title: 'Big Buck Bunny',
      durationMs: 600_000,
      thumbnailUrl: null,
    },
    queueLength: 1,
    presentCount: 2,
    status: 'open',
    closedReason: null,
    version: 1,
    createdAt: '2026-11-05T10:00:00.000Z',
    startedAt: null,
    ...overrides,
  };
}

/** What a member who holds `permissions` through Member's role hears first on joining the room. */
export function partyHello(
  overrides: Partial<Extract<WatchPartyServerFrame, { type: 'hello' }>> = {}
): WatchPartyServerFrame {
  const memberRoleId = partyId(0x9301);
  return {
    type: 'hello',
    room: partyRoom(),
    roles: [
      {
        id: memberRoleId,
        key: 'member',
        kind: 'grant',
        name: 'Member',
        colour: null,
        position: 1,
        permissions: ['chat.post', 'chat.react'],
        memberCount: 2,
        updatedAt: '2026-11-05T10:00:00.000Z',
      },
    ],
    rolesVersion: 1,
    you: { memberKey: PARTY_VIEWER_KEY, kind: 'user', roleIds: [] },
    playback: { itemId: PARTY_ITEM_ID, phase: 'lobby', positionMs: 0, rate: 1, anchorAt: 0 },
    version: 1,
    serverNow: 1_000,
    queue: { items: [], version: 1 },
    roster: {
      entries: [
        {
          memberKey: PARTY_VIEWER_KEY,
          kind: 'user',
          source: 'app',
          name: 'Me',
          avatarUrl: null,
          roleIds: [],
          ready: false,
          sync: 'lobby',
          voice: 'off',
          away: false,
        },
        {
          memberKey: PARTY_OWNER_KEY,
          kind: 'user',
          source: 'app',
          name: 'Ana',
          avatarUrl: null,
          roleIds: [],
          ready: true,
          sync: 'lobby',
          voice: 'off',
          away: false,
        },
      ],
      guests: 0,
    },
    chat: { resume: 'fresh', mode: { enabled: true, slowModeSeconds: 0 }, pinned: null },
    ...overrides,
  };
}

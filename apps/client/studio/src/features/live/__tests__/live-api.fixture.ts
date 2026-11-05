import {
  createLiveChatTicket,
  getLiveOverlay,
  type LiveOverlayView,
  type LiveStreamView,
  openMyLiveStream,
  stopMyLiveStream,
  type UpdateLiveStreamBody,
  updateMyLiveStream,
} from '@vp/api-contracts';
import { CHANNEL_ID, LIVE_STREAM_ID, LIVE_VIDEO_ID, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

export const OVERLAY_TOKEN = 'overlay-token-123';
export const STREAM_KEY = 'sk_live_0190c3a05e1d7000';

export function liveStream(overrides: Partial<LiveStreamView> = {}): LiveStreamView {
  return {
    id: LIVE_STREAM_ID,
    status: 'IDLE',
    title: 'Friday build night',
    description: '',
    visibility: 'public',
    archiveVisibility: 'public',
    startedAt: null,
    endedAt: null,
    videoId: null,
    ingest: {
      rtmpUrl: 'rtmp://localhost:1935/live',
      streamKey: STREAM_KEY,
      whipUrl: 'http://localhost:8889/live/whip',
      overlayToken: OVERLAY_TOKEN,
      controlToken: 'control-token-456',
    },
    chat: { slowModeSeconds: 0, subscribersOnly: false },
    ...overrides,
  };
}

export function liveNow(overrides: Partial<LiveStreamView> = {}): LiveStreamView {
  return liveStream({
    status: 'LIVE',
    startedAt: new Date(Date.now() - 3_725_000).toISOString(),
    videoId: LIVE_VIDEO_ID,
    ...overrides,
  });
}

/** The creator endpoints over one stream: an update or a stop changes it, and each call is recorded. */
export function liveApi(initial: LiveStreamView = liveStream()) {
  let current = initial;
  const updates: UpdateLiveStreamBody[] = [];
  const stops: string[] = [];

  const handlers = [
    mockEndpoint(openMyLiveStream, () => HttpResponse.json(current)),
    mockEndpoint(updateMyLiveStream, async ({ request }) => {
      const changes = await request.json();
      updates.push(changes);
      current = {
        ...current,
        chat: {
          slowModeSeconds: changes.chatSlowModeSeconds ?? current.chat.slowModeSeconds,
          subscribersOnly: changes.chatSubscribersOnly ?? current.chat.subscribersOnly,
        },
      };
      return HttpResponse.json(current);
    }),
    mockEndpoint(stopMyLiveStream, ({ params }) => {
      stops.push(String(params.id));
      current = { ...current, status: 'ENDED', ingest: null, endedAt: new Date().toISOString() };
      return HttpResponse.json(current, { status: 202 });
    }),
  ];

  return { handlers, updates, stops };
}

/** The overlay endpoint; `subscribers` is read on every poll, so a spec raises it between two. */
export function overlayApi(subscribers: { count: number }, tokens: string[] = []) {
  const stream: LiveOverlayView['stream'] = {
    id: LIVE_STREAM_ID,
    status: 'IDLE',
    title: 'Friday build night',
    description: '',
    channel: { id: CHANNEL_ID, handle: 'creator', displayName: 'Creator', avatarUrl: null },
    videoId: null,
    startedAt: null,
    endedAt: null,
    viewers: 0,
    playbackUrl: null,
    chat: { slowModeSeconds: 0, subscribersOnly: false },
  };
  return mockEndpoint(getLiveOverlay, ({ params }) => {
    tokens.push(String(params.token));
    return HttpResponse.json({ stream, subscriberCount: subscribers.count });
  });
}

export const chatTicket = mockEndpoint(createLiveChatTicket, () =>
  HttpResponse.json(
    { ticket: 'ticket-1', expiresAt: new Date(Date.now() + 30_000).toISOString() },
    { status: 201 }
  )
);

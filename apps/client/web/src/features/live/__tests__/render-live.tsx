import {
  type Account,
  createLiveChatTicket,
  getLiveChatReplay,
  getLiveStream,
  type LiveChatMessageView,
  type LiveChatServerFrame,
  type LiveStreamPublicView,
} from '@vp/api-contracts';
import { apiServer, LIVE_STREAM_ID, liveStream, mockEndpoint } from '@vp/web-testing';
import { mockLiveChatSocket, renderRoute, stubEventSource } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

interface LiveOptions {
  stream?: Partial<LiveStreamPublicView>;
  viewer?: Account;
  lines?: readonly LiveChatServerFrame[];
  replay?: readonly LiveChatMessageView[];
  /** Whether the socket lets the viewer send; a signed-in viewer can by default. */
  canSend?: boolean;
  handlers?: HttpHandler[];
}

/**
 * `/live/$streamId` of one broadcast, as a guest or as `viewer`: its chat socket sends `lines`, its
 * replay answers from `replay` by offset, and the video's event stream is the spec's to `emit` on.
 * The spec mocks the player module itself.
 */
export async function renderLive({
  stream = {},
  viewer,
  lines = [],
  replay = [],
  canSend = viewer !== undefined,
  handlers = [],
}: LiveOptions = {}) {
  const events = stubEventSource();
  const socket = mockLiveChatSocket(lines, { canSend });
  const replayWindows: string[] = [];
  apiServer.use(socket.handler);

  const rendered = await renderRoute(getRouter, `/live/${LIVE_STREAM_ID}`, {
    handlers: [
      ...handlers,
      ...(viewer ? [signInBrowser(viewer)] : []),
      mockEndpoint(getLiveStream, () => HttpResponse.json(liveStream(stream))),
      mockEndpoint(createLiveChatTicket, () =>
        HttpResponse.json(
          { ticket: 'ticket-1', expiresAt: '2026-11-05T10:00:30.000Z' },
          { status: 201 }
        )
      ),
      mockEndpoint(getLiveChatReplay, ({ request }) => {
        const { searchParams } = new URL(request.url);
        const fromMs = Number(searchParams.get('fromMs'));
        const toMs = Number(searchParams.get('toMs'));
        replayWindows.push(`${fromMs}-${toMs}`);
        return HttpResponse.json({
          items: replay.filter(({ offsetMs }) => offsetMs >= fromMs && offsetMs < toMs),
        });
      }),
      ...loaderApi(),
    ],
  });
  return { ...rendered, events, socket, replayWindows };
}

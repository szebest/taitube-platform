import {
  type Account,
  createWatchPartySocketTicket,
  getVideo,
  getWatchParty,
  type WatchPartyServerFrame,
} from '@vp/api-contracts';
import {
  apiServer,
  mockEndpoint,
  PARTY_ID,
  partyHello,
  partyPreview,
  video,
} from '@vp/web-testing';
import { mockWatchPartySocket, renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

interface PartyRouteOptions {
  preview?: Parameters<typeof partyPreview>[0];
  /** The signed-in viewer; a guest when left out. */
  viewer?: Account;
  /** What the room socket says after it accepts the connection. */
  frames?: readonly WatchPartyServerFrame[];
  path?: string;
  handlers?: HttpHandler[];
}

/**
 * `/parties/$roomId` as a guest or as `viewer`: the preview answers from `preview`, the room socket
 * says `frames`, and the room's video has a playback URL. The spec mocks the player module itself.
 */
export async function renderPartyRoute({
  preview = {},
  viewer,
  frames = [partyHello()],
  path = `/parties/${PARTY_ID}`,
  handlers = [],
}: PartyRouteOptions = {}) {
  const socket = mockWatchPartySocket(frames, 5_000);
  apiServer.use(socket.handler);

  const rendered = await renderRoute(getRouter, path, {
    handlers: [
      ...handlers,
      ...(viewer ? [signInBrowser(viewer)] : []),
      mockEndpoint(getWatchParty, () => HttpResponse.json(partyPreview(preview))),
      mockEndpoint(createWatchPartySocketTicket, () =>
        HttpResponse.json(
          { ticket: 'ticket-1', expiresAt: '2026-11-05T10:00:30.000Z' },
          { status: 201 }
        )
      ),
      mockEndpoint(getVideo, () =>
        HttpResponse.json(video({ playbackUrl: 'http://localhost:9000/hls/master.m3u8' }))
      ),
      ...loaderApi(),
    ],
  });

  return { ...rendered, socket };
}

import { screen } from '@testing-library/react';
import {
  type Account,
  getMyReaction,
  getVideo,
  isSubscribedToChannel,
  type Video,
} from '@vp/api-contracts';
import { CHANNEL_ID, channel, mockEndpoint, VIDEO_ID, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const { id, handle, displayName, avatarUrl } = channel();

interface WatchOptions {
  video?: Partial<Video>;
  viewer?: Account;
  search?: string;
  handlers?: HttpHandler[];
}

/** The watch page of a video with a channel, as a guest or as `viewer`, with the player stood in for. */
export async function renderWatch({
  video: overrides = {},
  viewer,
  search = '',
  handlers = [],
}: WatchOptions = {}) {
  const viewerApi = viewer
    ? [
        signInBrowser(viewer),
        mockEndpoint(getMyReaction, () => HttpResponse.json({ videoId: VIDEO_ID, reaction: null })),
        mockEndpoint(isSubscribedToChannel, () =>
          HttpResponse.json({ channelId: CHANNEL_ID, subscribed: false })
        ),
      ]
    : [];

  const rendered = await renderRoute(getRouter, `/watch/${VIDEO_ID}${search}`, {
    handlers: [
      ...handlers,
      ...viewerApi,
      mockEndpoint(getVideo, () =>
        HttpResponse.json(
          video({
            title: 'Launch day',
            playbackUrl: 'http://localhost:9000/hls/master.m3u8',
            channel: { id, handle, displayName, avatarUrl },
            likesCount: 24,
            viewsCount: 1_200_000,
            ...overrides,
          })
        )
      ),
      ...loaderApi(),
    ],
  });
  await screen.findByTestId('player');
  return rendered;
}

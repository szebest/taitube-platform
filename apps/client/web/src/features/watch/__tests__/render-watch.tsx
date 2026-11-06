import { screen } from '@testing-library/react';
import {
  type Account,
  getMyReaction,
  getPlaylist,
  getVideo,
  isSubscribedToChannel,
  type Video,
} from '@vp/api-contracts';
import { CHANNEL_ID, channel, mockEndpoint, VIDEO_ID, video, videoSummary } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { playlistDetail, uuid } from '#app/features/library/__tests__/library-fixtures';
import { getRouter } from '#app/router';

const { id, handle, displayName, avatarUrl } = channel();

interface WatchOptions {
  video?: Partial<Video>;
  viewer?: Account;
  search?: string;
  handlers?: HttpHandler[];
}

/** The watch page of a video with a channel, as a guest or as `viewer`, once its player is on the page. */
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
  await screen.findByRole('group', { name: 'Media player' });
  return rendered;
}

export const LIST = uuid(4100);
export const QUEUED = [uuid(6010), uuid(6011)];

/** The watch page of the video, opened from a playlist of it and two more, `Queued <id>` by title. */
export const renderPlaylistWatch = () =>
  renderWatch({
    search: `?list=${LIST}&index=0`,
    handlers: [
      mockEndpoint(getPlaylist, () =>
        HttpResponse.json(
          playlistDetail(LIST, [
            videoSummary({ id: VIDEO_ID, title: 'Launch day' }),
            ...QUEUED.map((id) => videoSummary({ id, title: `Queued ${id}` })),
          ])
        )
      ),
    ],
  });

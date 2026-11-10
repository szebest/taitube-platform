import { screen } from '@testing-library/react';
import {
  type Account,
  type ChannelMembershipView,
  getMyReaction,
  getOwnRestriction,
  getPlaylist,
  getVideo,
  isSubscribedToChannel,
  type PlaylistView,
  type Video,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import {
  CHANNEL_ID,
  channel,
  mockEndpoint,
  problemReply,
  VIDEO_ID,
  video,
  videoSummary,
} from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import { playlistDetail, seriesDetail, uuid } from './library-fixtures';

const { id, handle, displayName, avatarUrl } = channel();

/** A spec that keeps the real player waits for its lazy chunk, which a cold import under load takes seconds to load. */
const PLAYER_TIMEOUT_MS = 10_000;

interface WatchOptions {
  video?: Partial<Video>;
  viewer?: Account;
  memberships?: ChannelMembershipView[];
  search?: string;
  handlers?: HttpHandler[];
}

/** The watch page of a video with a channel, as a guest or as `viewer`, once its player is on the page. */
export async function renderWatch({
  video: overrides = {},
  viewer,
  memberships = [],
  search = '',
  handlers = [],
}: WatchOptions = {}) {
  const viewerApi = viewer
    ? [
        signInBrowser(viewer, memberships),
        mockEndpoint(getMyReaction, () => HttpResponse.json({ videoId: VIDEO_ID, reaction: null })),
        mockEndpoint(isSubscribedToChannel, () =>
          HttpResponse.json({ channelId: CHANNEL_ID, subscribed: false })
        ),
        mockEndpoint(getOwnRestriction, () => problemReply(ErrorCodes.RESTRICTION_NOT_FOUND)),
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
  await screen.findByRole('group', { name: 'Media player' }, { timeout: PLAYER_TIMEOUT_MS });
  return rendered;
}

export const LIST = uuid(4100);
export const QUEUED = [uuid(6010), uuid(6011)];

const PLAYLIST_VIDEOS = [
  videoSummary({ id: VIDEO_ID, title: 'Launch day' }),
  ...QUEUED.map((id) => videoSummary({ id, title: `Queued ${id}` })),
];

const watchFromList = (detail: PlaylistView) =>
  renderWatch({
    search: `?list=${LIST}&index=0`,
    handlers: [mockEndpoint(getPlaylist, () => HttpResponse.json(detail))],
  });

/** The watch page of the video, opened from a playlist of it and two more, `Queued <id>` by title. */
export const renderPlaylistWatch = () => watchFromList(playlistDetail(LIST, PLAYLIST_VIDEOS));

/** The same, opened from a series of the three. */
export const renderSeriesWatch = () =>
  watchFromList(seriesDetail(LIST, PLAYLIST_VIDEOS, [null, null, null], null));

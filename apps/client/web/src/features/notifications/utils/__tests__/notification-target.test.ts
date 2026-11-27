import { CHANNEL_ID, VIDEO_ID } from '@vp/web-testing';
import {
  COMMENT_ID,
  notification,
} from '#app/features/notifications/__tests__/notification-fixtures';
import { notificationTarget } from '../notification-target';

const PLAYLIST_ID = '0190c3a0-5e1d-7000-8000-0000000000f1';
const TOKEN = 'invite-token';
const PLAYLIST = {
  id: PLAYLIST_ID,
  title: 'Road trip',
  invite: { token: TOKEN, role: 'editor' as const },
};

describe('apps/client/web: notificationTarget', () => {
  it.each([
    {
      case: 'one upload opens the video',
      overrides: { kind: 'upload' as const },
      count: 1,
      target: { to: '/watch/$videoId', params: { videoId: VIDEO_ID }, search: {} },
    },
    {
      case: 'a group of uploads opens the channel',
      overrides: { kind: 'upload' as const },
      count: 3,
      target: { to: '/channel/$channelId', params: { channelId: CHANNEL_ID } },
    },
    {
      case: 'a live start opens the broadcast',
      overrides: { kind: 'live' as const },
      count: 1,
      target: { to: '/watch/$videoId', params: { videoId: VIDEO_ID }, search: {} },
    },
    {
      case: 'a reply opens its comment',
      overrides: { kind: 'reply' as const, commentId: COMMENT_ID },
      count: 1,
      target: {
        to: '/watch/$videoId',
        params: { videoId: VIDEO_ID },
        search: { comment: COMMENT_ID },
      },
    },
    {
      case: 'a team invite has no video to open',
      overrides: { kind: 'team_invite' as const, videoId: null },
      count: 1,
      target: undefined,
    },
    {
      case: 'a moderation notice opens the moderation page for the channel that acted',
      overrides: { kind: 'moderation' as const, videoId: null, actorChannelId: CHANNEL_ID },
      count: 1,
      target: { to: '/feed/you/moderation', search: { channel: CHANNEL_ID } },
    },
    {
      case: 'a moderation notice with no channel opens the moderation page',
      overrides: { kind: 'moderation' as const, videoId: null, actorChannelId: null },
      count: 1,
      target: { to: '/feed/you/moderation', search: {} },
    },
    {
      case: 'a playlist invite opens the page that answers it',
      overrides: { kind: 'playlist_invite' as const, videoId: null },
      count: 1,
      target: {
        to: '/playlist-invite/$token',
        params: { token: TOKEN },
        search: { via: 'notification' },
      },
    },
    {
      case: 'a playlist update opens the playlist',
      overrides: { kind: 'playlist_update' as const, videoId: null },
      count: 1,
      target: { to: '/playlist', search: { list: PLAYLIST_ID } },
    },
    {
      case: 'a notification with no video opens nothing',
      overrides: { kind: 'processing' as const, videoId: null },
      count: 1,
      target: undefined,
    },
  ])('$case', ({ overrides, count, target }) => {
    expect(notificationTarget(notification(overrides, { count, playlist: PLAYLIST }))).toEqual(
      target
    );
  });
});

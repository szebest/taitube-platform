import { CHANNEL_ID, VIDEO_ID } from '@vp/web-testing';
import { notificationTarget } from '../notification-target';
import { COMMENT_ID, notification } from './notification-fixtures';

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
      case: 'a notification with no video opens nothing',
      overrides: { kind: 'processing' as const, videoId: null },
      count: 1,
      target: undefined,
    },
  ])('$case', ({ overrides, count, target }) => {
    expect(notificationTarget(notification(overrides, { count }))).toEqual(target);
  });
});

import { CHANNEL_ID, VIDEO_ID } from '@vp/web-testing';
import { notificationTarget } from '../notification-target';
import { COMMENT_ID, notification } from './notification-fixtures';

describe('apps/client/web: notificationTarget', () => {
  it.each([
    {
      case: 'one upload opens the video',
      overrides: { kind: 'upload' as const },
      count: 1,
      target: { page: 'watch', videoId: VIDEO_ID },
    },
    {
      case: 'a group of uploads opens the channel',
      overrides: { kind: 'upload' as const },
      count: 3,
      target: { page: 'channel', channelId: CHANNEL_ID },
    },
    {
      case: 'a live start opens the broadcast',
      overrides: { kind: 'live' as const },
      count: 1,
      target: { page: 'watch', videoId: VIDEO_ID },
    },
    {
      case: 'a reply opens its comment',
      overrides: { kind: 'reply' as const, commentId: COMMENT_ID },
      count: 1,
      target: { page: 'watch', videoId: VIDEO_ID, commentId: COMMENT_ID },
    },
    {
      case: 'a notification with no video opens nothing',
      overrides: { kind: 'processing' as const, videoId: null },
      count: 1,
      target: { page: 'none' },
    },
  ])('$case', ({ overrides, count, target }) => {
    expect(notificationTarget(notification(overrides, { count }))).toEqual(target);
  });
});

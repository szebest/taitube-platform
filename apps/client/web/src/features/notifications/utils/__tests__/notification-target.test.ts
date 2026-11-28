import { CHANNEL_ID, VIDEO_ID } from '@vp/web-testing';
import {
  COMMENT_ID,
  notification,
} from '#app/features/notifications/__tests__/notification-fixtures';
import { notificationTarget } from '../notification-target';

const POST_ID = '0190c3a0-5e1d-7000-8000-0000000000a1';
const THREAD_ID = '0190c3a0-5e1d-7000-8000-0000000000b1';
const ROOM_ID = '0190c3a0-5e1d-7000-8000-0000000000f1';
const INVITE_ID = '0190c3a0-5e1d-7000-8000-0000000000f2';
const PARTY = {
  roomId: ROOM_ID,
  name: 'Movie night',
  videoTitle: null,
  scheduledFor: null,
  inviteId: INVITE_ID,
  expiresAt: '2026-01-03T03:04:05.000Z',
  watching: { names: [], count: 0 },
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
      case: 'a reply under a post opens the post',
      overrides: { kind: 'reply' as const, videoId: null, commentId: COMMENT_ID },
      payload: { postId: POST_ID },
      count: 1,
      target: { to: '/post/$id', params: { id: POST_ID }, search: {} },
    },
    {
      case: 'a reply under a thread opens the thread on its video',
      overrides: { kind: 'reply' as const, commentId: COMMENT_ID },
      payload: { threadId: THREAD_ID },
      count: 1,
      target: {
        to: '/watch/$videoId',
        params: { videoId: VIDEO_ID },
        search: { tab: 'threads', thread: THREAD_ID, comment: COMMENT_ID },
      },
    },
    {
      case: 'a post opens its channel',
      overrides: { kind: 'post' as const, videoId: null },
      count: 1,
      target: { to: '/channel/$channelId', params: { channelId: CHANNEL_ID } },
    },
    {
      case: 'a post with no channel opens nothing',
      overrides: { kind: 'post' as const, videoId: null, actorChannelId: null },
      count: 1,
      target: undefined,
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
      case: 'a party invite opens the room on its invite',
      overrides: { kind: 'party_invite' as const, videoId: null },
      payload: { party: PARTY },
      count: 1,
      target: {
        to: '/parties/$roomId',
        params: { roomId: ROOM_ID },
        search: { invite: INVITE_ID },
      },
    },
    {
      case: 'a party starting opens the room with no invite',
      overrides: { kind: 'party_starting' as const, videoId: null },
      payload: { party: PARTY },
      count: 1,
      target: { to: '/parties/$roomId', params: { roomId: ROOM_ID }, search: {} },
    },
    {
      case: 'a party notification with no room opens nothing',
      overrides: { kind: 'party_invite' as const, videoId: null },
      count: 1,
      target: undefined,
    },
    {
      case: 'a notification with no video opens nothing',
      overrides: { kind: 'processing' as const, videoId: null },
      count: 1,
      target: undefined,
    },
  ])('$case', ({ overrides, payload, count, target }) => {
    expect(notificationTarget(notification(overrides, { count, ...payload }))).toEqual(target);
  });
});

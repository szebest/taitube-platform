import {
  type NewNotificationInput,
  type Notification,
  type NotificationKind,
  type NotificationLevel,
  NOTIFICATION_KINDS,
  foldNotification,
  kindsOfFilter,
  levelAllows,
  mentionedHandles,
  toNotificationView,
} from '../notification';
import { notificationCreated, notificationRead } from '../user-event';

const NOTIFICATION: Notification = {
  id: 'n1',
  userId: 'u1',
  kind: 'upload',
  actorChannelId: 'c1',
  videoId: 'v1',
  commentId: null,
  groupKey: 'upload:c1',
  payload: { count: 3, actor: null, videoTitle: 'Dinner', excerpt: null, outcome: null },
  readAt: null,
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
};

describe('domain: notification', () => {
  it.each<{ level: NotificationLevel; allowed: NotificationKind[] }>([
    { level: 'all', allowed: [...NOTIFICATION_KINDS] },
    { level: 'highlights', allowed: NOTIFICATION_KINDS.filter((kind) => kind !== 'live') },
    { level: 'none', allowed: [] },
  ])('a subscriber at level $level lets through $allowed', ({ level, allowed }) => {
    expect(NOTIFICATION_KINDS.filter((kind) => levelAllows(level, kind))).toEqual(allowed);
  });

  it.each([
    { filter: 'all' as const, kinds: NOTIFICATION_KINDS },
    { filter: 'subscriptions' as const, kinds: ['upload', 'live'] },
    { filter: 'mentions' as const, kinds: ['reply', 'mention'] },
  ])('the $filter filter lists $kinds', ({ filter, kinds }) => {
    expect(kindsOfFilter(filter)).toEqual(kinds);
  });

  it.each([
    { content: 'thanks @night.kitchen for this', handles: ['night.kitchen'] },
    { content: 'hi @bob_1. and @bob_1', handles: ['bob_1.', 'bob_1'] },
    { content: 'mail me at a@bob.dev', handles: [] },
    { content: '@ab too short', handles: [] },
    { content: 'no mentions here', handles: [] },
  ])('finds $handles in "$content"', ({ content, handles }) => {
    expect(mentionedHandles(content)).toEqual(handles);
  });

  it('caps the mentions of one comment', () => {
    const content = Array.from({ length: 20 }, (_, i) => `@user${i}`).join(' ');

    expect(mentionedHandles(content)).toHaveLength(10);
  });

  it('shows a notification as the API returns it', () => {
    expect(toNotificationView(NOTIFICATION)).toEqual({
      id: 'n1',
      kind: 'upload',
      actorChannelId: 'c1',
      videoId: 'v1',
      commentId: null,
      payload: NOTIFICATION.payload,
      read: false,
      createdAt: '2026-01-02T03:04:05.000Z',
    });
    expect(toNotificationView({ ...NOTIFICATION, readAt: new Date() }).read).toBe(true);
  });

  it('announces a notification with the unread count it made', () => {
    expect(notificationCreated(toNotificationView(NOTIFICATION), 4)).toMatchObject({
      type: 'notification.created',
      payload: { notification: { id: 'n1' }, unreadCount: 4 },
    });
  });

  it.each([
    { scope: { scope: 'all' as const }, unreadCount: 0 },
    { scope: { scope: 'ids' as const, ids: ['n1'] }, unreadCount: 2 },
  ])('announces reading $scope', ({ scope, unreadCount }) => {
    expect(notificationRead(scope, unreadCount)).toEqual({
      type: 'notification.read',
      payload: { ...scope, unreadCount },
    });
  });

  describe('folding a group', () => {
    const NEXT: NewNotificationInput = {
      userId: 'u1',
      kind: 'upload',
      actorChannelId: 'c1',
      videoId: 'v2',
      commentId: null,
      groupKey: 'upload:c1',
      payload: { actor: null, videoTitle: 'Lunch', excerpt: null, outcome: null },
    };
    const NOW = new Date('2026-01-02T03:30:00.000Z');

    it('counts one more, takes the newest subject and moves to the top', () => {
      expect(foldNotification(NOTIFICATION, NEXT, NOW)).toMatchObject({
        id: 'n1',
        videoId: 'v2',
        payload: { count: 4, videoTitle: 'Lunch' },
        createdAt: NOW,
      });
    });

    it('changes nothing for the subject it already holds', () => {
      expect(foldNotification(NOTIFICATION, { ...NEXT, videoId: 'v1' }, NOW)).toBeNull();
    });
  });
});

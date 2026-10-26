import type { NotificationRepositoryPort } from '@vp/core/repositories';
import {
  type NewNotificationInput,
  NOTIFICATION_RETENTION_DAYS,
  notificationCreated,
  notificationRead,
  toNotificationView,
} from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import { expectOk } from '@vp/testing/result';
import { HOUR_MS, OTHER_OWNER_ID, OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const CHANNEL_ID = '00000000-0000-7000-8000-000000000901';
const ACTOR = { handle: 'night-kitchen', displayName: 'Night Kitchen', avatarUrl: null };

function upload(
  videoId: string,
  overrides: Partial<NewNotificationInput> = {}
): NewNotificationInput {
  return {
    userId: OTHER_OWNER_ID,
    kind: 'upload',
    actorChannelId: CHANNEL_ID,
    videoId,
    commentId: null,
    groupKey: `upload:${CHANNEL_ID}`,
    payload: {
      actor: ACTOR,
      videoTitle: `Video ${videoId.slice(-1)}`,
      excerpt: null,
      outcome: null,
    },
    ...overrides,
  };
}

export function describeNotificationRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('NotificationRepository contract', () => {
    let subject: RepositoriesSubject;
    let notifications: NotificationRepositoryPort;

    const tryRecord = async (input: NewNotificationInput) =>
      expectOk(await notifications.record(input));

    const record = async (input: NewNotificationInput) => {
      const stored = await tryRecord(input);
      if (!stored) throw new Error('the notification was counted into an existing one');
      return stored;
    };

    const announced = async () =>
      expectOk(await subject.repositories.userEvents.listFrom(OTHER_OWNER_ID, 0, 50)).map(
        ({ type, payload }) => ({ type, payload })
      );

    const list = async (filter: 'all' | 'subscriptions' | 'mentions' = 'all', limit = 50) =>
      expectOk(await notifications.list(OTHER_OWNER_ID, { filter, limit }));

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await subject.repositories.channels.create({
        id: CHANNEL_ID,
        userId: OWNER_ID,
        handle: 'night-kitchen',
        displayName: 'Night Kitchen',
      });
      for (const id of Object.values(VIDEO_IDS)) await subject.seedVideo(publicVideo({ id }));
      notifications = subject.repositories.notifications;
    });

    it('stores a notification with a count of one and announces it with the unread count', async () => {
      const stored = await record(upload(VIDEO_IDS.a));

      expect(stored).toMatchObject({
        userId: OTHER_OWNER_ID,
        kind: 'upload',
        videoId: VIDEO_IDS.a,
        readAt: null,
        payload: { count: 1, videoTitle: 'Video a' },
      });
      expect(await announced()).toEqual([notificationCreated(toNotificationView(stored), 1)]);
    });

    it('folds the events of one group inside an hour into one row with a count', async () => {
      await record(upload(VIDEO_IDS.a));
      await subject.ageNotifications(20 * 60_000);
      await record(upload(VIDEO_IDS.b));
      await subject.ageNotifications(20 * 60_000);
      const folded = await record(upload(VIDEO_IDS.c));

      const rows = await list();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: folded.id,
        videoId: VIDEO_IDS.c,
        payload: { count: 3, videoTitle: 'Video c' },
      });
      expect(await announced()).toHaveLength(3);
      expect(expectOk(await notifications.unreadCount(OTHER_OWNER_ID))).toBe(1);
    });

    it('starts a new row once the hour has passed since the last event of the group', async () => {
      await record(upload(VIDEO_IDS.a));
      await subject.ageNotifications(HOUR_MS + 1);
      await record(upload(VIDEO_IDS.b));

      expect((await list()).map((row) => row.payload.count)).toEqual([1, 1]);
    });

    it('starts a new row after the group was read', async () => {
      await record(upload(VIDEO_IDS.a));
      expectOk(await notifications.markRead(OTHER_OWNER_ID, { scope: 'all' }));
      await record(upload(VIDEO_IDS.b));

      expect((await list()).map((row) => [row.payload.count, row.readAt === null])).toEqual([
        [1, true],
        [1, false],
      ]);
    });

    it('keeps groups of different channels and users apart', async () => {
      await record(upload(VIDEO_IDS.a));
      await record(upload(VIDEO_IDS.b, { groupKey: 'upload:another' }));
      await record(upload(VIDEO_IDS.c, { userId: OWNER_ID }));

      expect(await list()).toHaveLength(2);
    });

    it('counts the same subject once when a job runs again', async () => {
      await record(upload(VIDEO_IDS.a));

      expect(await tryRecord(upload(VIDEO_IDS.a))).toBeNull();
      expect((await list())[0]?.payload.count).toBe(1);
      expect(await announced()).toHaveLength(1);
    });

    it('counts the same subject once when a job runs again after the row was read', async () => {
      await record(upload(VIDEO_IDS.a));
      expectOk(await notifications.markRead(OTHER_OWNER_ID, { scope: 'all' }));

      expect(await tryRecord(upload(VIDEO_IDS.a))).toBeNull();
      expect(await list()).toHaveLength(1);
    });

    it('never folds a notification without a group', async () => {
      const processing = (videoId: string) =>
        upload(videoId, { kind: 'processing', groupKey: null, actorChannelId: null });
      await record(processing(VIDEO_IDS.a));
      await record(processing(VIDEO_IDS.b));

      expect(await list()).toHaveLength(2);
    });

    it('lists newest first, in pages, and by filter', async () => {
      await record(upload(VIDEO_IDS.a, { groupKey: 'g-a' }));
      await subject.ageNotifications(2000);
      await record(upload(VIDEO_IDS.b, { kind: 'mention', groupKey: 'g-b' }));
      await subject.ageNotifications(2000);
      await record(upload(VIDEO_IDS.c, { kind: 'live', groupKey: 'g-c' }));

      expect((await list()).map((row) => row.videoId)).toEqual([
        VIDEO_IDS.c,
        VIDEO_IDS.b,
        VIDEO_IDS.a,
      ]);
      expect((await list('subscriptions')).map((row) => row.kind)).toEqual(['live', 'upload']);
      expect((await list('mentions')).map((row) => row.kind)).toEqual(['mention']);

      const firstPage = await list('all', 1);
      expect(firstPage).toHaveLength(2);
      const first = firstPage[0];
      if (!first) throw new Error('the first page is empty');
      const next = expectOk(
        await notifications.list(OTHER_OWNER_ID, {
          filter: 'all',
          limit: 1,
          cursor: { createdAt: first.createdAt, id: first.id },
        })
      );
      expect(next.map((row) => row.videoId)).toEqual([VIDEO_IDS.b, VIDEO_IDS.a]);
    });

    it('marks the given ids as read and announces the ones that changed', async () => {
      const first = await record(upload(VIDEO_IDS.a, { groupKey: null }));
      const second = await record(upload(VIDEO_IDS.b, { groupKey: null }));

      const marked = expectOk(
        await notifications.markRead(OTHER_OWNER_ID, { scope: 'ids', ids: [first.id] })
      );
      expect(marked).toEqual({ read: [first.id], unreadCount: 1 });

      const repeated = expectOk(
        await notifications.markRead(OTHER_OWNER_ID, { scope: 'ids', ids: [first.id] })
      );
      expect(repeated).toEqual({ read: [], unreadCount: 1 });
      expect((await announced()).slice(2)).toEqual([
        notificationRead({ scope: 'ids', ids: [first.id] }, 1),
      ]);
      expect(second.readAt).toBeNull();
    });

    it('marks everything as read', async () => {
      await record(upload(VIDEO_IDS.a, { groupKey: null }));
      await record(upload(VIDEO_IDS.b, { groupKey: null }));

      expect(
        expectOk(await notifications.markRead(OTHER_OWNER_ID, { scope: 'all' }))
      ).toMatchObject({ unreadCount: 0 });
      expect((await announced()).at(-1)).toEqual(notificationRead({ scope: 'all' }, 0));
    });

    it("leaves another user's notifications alone", async () => {
      const mine = await record(upload(VIDEO_IDS.a, { userId: OWNER_ID, groupKey: null }));

      const marked = expectOk(
        await notifications.markRead(OTHER_OWNER_ID, { scope: 'ids', ids: [mine.id] })
      );

      expect(marked.read).toEqual([]);
      expect(expectOk(await notifications.unreadCount(OWNER_ID))).toBe(1);
    });

    it('finds notifications by id, absent ids included', async () => {
      const stored = await record(upload(VIDEO_IDS.a));

      const found = expectOk(await notifications.findByIds([stored.id, VIDEO_IDS.f]));

      expect(found.map((row) => row.id)).toEqual([stored.id]);
      expect(expectOk(await notifications.findByIds([]))).toEqual([]);
    });

    it('prunes what is older than the retention window', async () => {
      await record(upload(VIDEO_IDS.a, { groupKey: null }));
      await subject.ageNotifications((NOTIFICATION_RETENTION_DAYS + 1) * MS_PER_DAY);
      await record(upload(VIDEO_IDS.b, { groupKey: null }));

      expect(expectOk(await notifications.prune(NOTIFICATION_RETENTION_DAYS))).toBe(1);
      expect((await list()).map((row) => row.videoId)).toEqual([VIDEO_IDS.b]);
    });
  });
}

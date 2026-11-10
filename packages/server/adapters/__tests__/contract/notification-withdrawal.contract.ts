import { notificationRead } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const COMMENT_IDS = {
  first: '00000000-0000-7000-8000-000000000c01',
  second: '00000000-0000-7000-8000-000000000c02',
  third: '00000000-0000-7000-8000-000000000c03',
} as const;

export function describeNotificationWithdrawalContract(makeSubject: MakeRepositoriesSubject): void {
  describe('NotificationRepository withdrawal contract', () => {
    let subject: RepositoriesSubject;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
    });

    const about = (commentId: string) => ({
      userId: OTHER_OWNER_ID,
      kind: 'reply' as const,
      actorChannelId: null,
      videoId: VIDEO_IDS.a,
      commentId,
      groupKey: `reply:${commentId}`,
      payload: { actor: null, videoTitle: 'Video a', excerpt: null, outcome: null },
    });

    it('withdraws the unread notifications about the given comments and announces the cleared ids', async () => {
      const { notifications, comments, userEvents } = subject.repositories;
      for (const id of Object.values(COMMENT_IDS)) {
        expectOk(
          await comments.create({
            id,
            videoId: VIDEO_IDS.a,
            authorId: OWNER_ID,
            parentId: null,
            content: 'hello',
          })
        );
      }
      const [first, second, third] = [COMMENT_IDS.first, COMMENT_IDS.second, COMMENT_IDS.third];
      const read = expectOk(await notifications.record(about(first)));
      const unread = expectOk(await notifications.record(about(second)));
      expectOk(await notifications.record(about(third)));
      expectOk(
        await notifications.markRead(OTHER_OWNER_ID, { scope: 'ids', ids: read ? [read.id] : [] })
      );

      expect(expectOk(await notifications.withdrawUnread([]))).toBe(0);
      expect(expectOk(await notifications.withdrawUnread([first, second]))).toBe(1);

      const left = expectOk(await notifications.list(OTHER_OWNER_ID, { filter: 'all', limit: 10 }));
      expect(left.map((row) => row.commentId).sort()).toEqual([first, third].sort());
      const events = expectOk(await userEvents.listFrom(OTHER_OWNER_ID, 0, 50));
      expect(events.at(-1)).toMatchObject(
        notificationRead({ scope: 'ids', ids: unread ? [unread.id] : [] }, 1)
      );
    });
  });
}

import { expectOk } from '@kit/testing/result';
import { type NewNotificationInput, toNotificationView } from '@vp/domain';
import { OTHER_OWNER_ID, OWNER_CHANNEL_ID as CHANNEL_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const POST_A = '00000000-0000-7000-8000-00000000f101';
const POST_B = '00000000-0000-7000-8000-00000000f102';

const post = (postId: string): NewNotificationInput => ({
  userId: OTHER_OWNER_ID,
  kind: 'post',
  actorChannelId: CHANNEL_ID,
  videoId: null,
  commentId: null,
  groupKey: `post:${CHANNEL_ID}`,
  payload: {
    actor: { handle: 'owner', displayName: 'Owner', avatarUrl: null },
    videoTitle: null,
    excerpt: `Post ${postId.slice(-1)}`,
    outcome: null,
    postId,
  },
});

export function describeNotificationPostsContract(makeSubject: MakeRepositoriesSubject): void {
  describe('posts', () => {
    let subject: RepositoriesSubject;

    const record = async (input: NewNotificationInput) =>
      expectOk(await subject.repositories.notifications.record(input));
    const list = async (filter: 'all' | 'subscriptions' | 'mentions' = 'all') =>
      expectOk(
        await subject.repositories.notifications.list(OTHER_OWNER_ID, { filter, limit: 50 })
      );

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
    });

    it('keeps the post on the row and in the view, and lists it with the subscriptions', async () => {
      const stored = await record(post(POST_A));

      expect(stored).toMatchObject({ kind: 'post', payload: { postId: POST_A } });
      expect(toNotificationView(stored ?? failed()).payload).toMatchObject({ postId: POST_A });
      expect(await list('subscriptions')).toHaveLength(1);
      expect(await list('mentions')).toHaveLength(0);
    });

    it('folds a different post of the channel into the row and counts a repeat of one once', async () => {
      await record(post(POST_A));
      expect(await record(post(POST_A))).toBeNull();
      const folded = await record(post(POST_B));

      expect(await list()).toMatchObject([
        { id: folded?.id, payload: { count: 2, postId: POST_B, excerpt: 'Post 2' } },
      ]);
    });
  });
}

function failed(): never {
  throw new Error('the notification was not stored');
}

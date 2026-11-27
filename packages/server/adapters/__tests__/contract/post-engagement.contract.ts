import { expectOk } from '@kit/testing/result';
import type { PostEngagementRepositoryPort } from '@vp/core/repositories';
import type { PostPayload } from '@vp/domain';
import {
  type ChannelPostContractContext,
  POST_IDS,
  postInput,
  postAudit,
} from './channel-post-contract-context';
import { OTHER_OWNER_ID, OWNER_ID } from './fixtures';
import { SUBSCRIBER_ID } from './subscriber-fixtures';

const DAY = '2026-03-01';

export function describePostEngagementContract(ctx: ChannelPostContractContext): void {
  describe('post engagement', () => {
    let engagement: PostEngagementRepositoryPort;

    const publishPoll = async (id: string, correctIndex: number | null = null) => {
      const base = postInput(id);
      const poll = { question: 'Q?', options: ['a', 'b', 'c'], closesAt: null };
      const payload: PostPayload =
        correctIndex === null
          ? { kind: 'poll', ...poll }
          : { kind: 'quiz', ...poll, correctIndex, explanation: null };
      expectOk(await ctx.posts.publish({ ...base, payload }, postAudit('post.published', id)));
    };

    beforeEach(() => {
      engagement = ctx.subject.repositories.postEngagement;
    });

    it('takes one final vote per user and answers already_voted to the second, whatever the option', async () => {
      await publishPoll(POST_IDS.a);

      const first = expectOk(await engagement.vote(POST_IDS.a, SUBSCRIBER_ID, 1));
      const second = expectOk(await engagement.vote(POST_IDS.a, SUBSCRIBER_ID, 2));

      expect([first, second]).toEqual(['voted', 'already_voted']);
      expect(expectOk(await engagement.votedIndexes([POST_IDS.a], SUBSCRIBER_ID))).toEqual(
        new Map([[POST_IDS.a, 1]])
      );
    });

    it('counts a double submit once even when both arrive together', async () => {
      await publishPoll(POST_IDS.a);

      const outcomes = await Promise.all([
        engagement.vote(POST_IDS.a, SUBSCRIBER_ID, 0),
        engagement.vote(POST_IDS.a, SUBSCRIBER_ID, 0),
      ]);

      expect(outcomes.map((outcome) => expectOk(outcome)).sort()).toEqual([
        'already_voted',
        'voted',
      ]);
      expect(expectOk(await engagement.tallies([POST_IDS.a])).get(POST_IDS.a)?.[0]).toBe(1);
    });

    it('answers missing for a post that is not there', async () => {
      expect(expectOk(await engagement.vote(POST_IDS.missing, SUBSCRIBER_ID, 0))).toBe('missing');
    });

    it('tallies votes per option and leaves a post without votes absent', async () => {
      await publishPoll(POST_IDS.a);
      await publishPoll(POST_IDS.b);
      expectOk(await engagement.vote(POST_IDS.a, SUBSCRIBER_ID, 0));
      expectOk(await engagement.vote(POST_IDS.a, OTHER_OWNER_ID, 0));
      expectOk(await engagement.vote(POST_IDS.a, OWNER_ID, 2));

      const tallies = expectOk(await engagement.tallies([POST_IDS.a, POST_IDS.b]));

      expect(tallies.get(POST_IDS.a)?.slice(0, 3)).toEqual([2, 0, 1]);
      expect(tallies.has(POST_IDS.b)).toBe(false);
    });

    it('records opens and share clicks per day and reads them back with the poll figures', async () => {
      await publishPoll(POST_IDS.a, 1);
      expectOk(await engagement.vote(POST_IDS.a, SUBSCRIBER_ID, 1));
      expectOk(await engagement.vote(POST_IDS.a, OTHER_OWNER_ID, 1));
      expectOk(await engagement.vote(POST_IDS.a, OWNER_ID, 0));
      expectOk(await engagement.addOpen(POST_IDS.a, DAY));
      expectOk(await engagement.addOpen(POST_IDS.a, DAY));
      expectOk(await engagement.addOpen(POST_IDS.a, '2026-03-02'));
      expectOk(await engagement.addShareClick(POST_IDS.a, DAY));

      const stats = expectOk(await engagement.stats(POST_IDS.a));

      expect(stats).toMatchObject({
        opens: 3,
        shareClicks: 1,
        likes: 0,
        replies: 0,
        votesByOption: [1, 2, 0],
      });
      expect(stats?.quizCorrectShare).toBeCloseTo(2 / 3);
    });

    it('has no quiz share for a poll or before any answer, and no stats for a missing post', async () => {
      await publishPoll(POST_IDS.a);
      await publishPoll(POST_IDS.b, 0);

      expect(expectOk(await engagement.stats(POST_IDS.a))?.quizCorrectShare).toBeNull();
      expect(expectOk(await engagement.stats(POST_IDS.b))).toMatchObject({
        quizCorrectShare: null,
        votesByOption: [0, 0, 0],
      });
      expect(expectOk(await engagement.stats(POST_IDS.missing))).toBeNull();
    });
  });
}

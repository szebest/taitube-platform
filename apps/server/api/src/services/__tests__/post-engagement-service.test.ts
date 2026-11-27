import { expectErr, expectOk } from '@kit/testing/result';
import type { ChannelUserRestrictionRepositoryPort } from '@vp/core/repositories';
import type { PostPayload } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { NOW, postsFixture } from './post-deps';

const DAY = 86_400_000;
const VOTER: UserContext = { id: '00000000-0000-7000-8000-000000001301', role: 'USER' };
const OTHER: UserContext = { id: '00000000-0000-7000-8000-000000001302', role: 'USER' };
const POLL: PostPayload = {
  kind: 'poll',
  question: 'Best?',
  options: ['a', 'b', 'c'],
  closesAt: null,
};
const QUIZ: PostPayload = {
  kind: 'quiz',
  question: 'Which?',
  options: ['a', 'b', 'c'],
  closesAt: null,
  correctIndex: 2,
  explanation: 'It is c',
};

describe('apps/server/api/services: PostEngagementService', () => {
  describe('vote', () => {
    it('shows the results only after voting, counting the vote it just took', async () => {
      const { service, engagementService, publish } = await postsFixture();
      const poll = await publish(POLL);
      const before = expectOk(await service.get(VOTER, poll.id));

      const after = expectOk(await engagementService.vote(VOTER, poll.id, 1));

      expect(before.body).toMatchObject({ votedIndex: null, totalVotes: null });
      expect(after.body).toMatchObject({
        kind: 'poll',
        votedIndex: 1,
        totalVotes: 1,
        options: [{ votes: 0 }, { votes: 1 }, { votes: 0 }],
      });
    });

    it('hides the answer of a quiz until it is answered, then reveals it with the explanation', async () => {
      const { service, engagementService, publish } = await postsFixture();
      const quiz = await publish(QUIZ);

      const hidden = expectOk(await service.get(VOTER, quiz.id));
      const revealed = expectOk(await engagementService.vote(VOTER, quiz.id, 0));

      expect(hidden.body).toMatchObject({ correctIndex: null, explanation: null });
      expect(revealed.body).toMatchObject({ correctIndex: 2, explanation: 'It is c' });
    });

    it('answers a second vote with POST_ALREADY_VOTED and leaves the first as it was', async () => {
      const { engagementService, publish } = await postsFixture();
      const poll = await publish(POLL);
      expectOk(await engagementService.vote(VOTER, poll.id, 0));

      const failure = expectErr(await engagementService.vote(VOTER, poll.id, 2));

      expect(failure.code).toBe(ErrorCodes.POST_ALREADY_VOTED);
      expect(expectOk(await engagementService.vote(OTHER, poll.id, 0)).body).toMatchObject({
        totalVotes: 2,
        options: [{ votes: 2 }, { votes: 0 }, { votes: 0 }],
      });
    });

    it.each([
      { scenario: 'an anonymous caller', user: null, code: ErrorCodes.UNAUTHORIZED },
      {
        scenario: 'a guest identity',
        user: { id: VOTER.id, role: 'GUEST' } as UserContext,
        code: ErrorCodes.FORBIDDEN,
      },
    ])('refuses $scenario', async ({ user, code }) => {
      const { engagementService, publish } = await postsFixture();
      const poll = await publish(POLL);

      const failure = expectErr(await engagementService.vote(user as UserContext, poll.id, 0));

      expect(failure.code).toBe(code);
    });

    it.each([
      { scenario: 'an option past the list', index: 3 },
      { scenario: 'a negative option', index: -1 },
    ])('refuses $scenario as invalid', async ({ index }) => {
      const { engagementService, publish } = await postsFixture();
      const poll = await publish(POLL);

      expect(expectErr(await engagementService.vote(VOTER, poll.id, index)).code).toBe(
        ErrorCodes.VALIDATION_FAILED
      );
    });

    it('refuses a vote on a post that is no poll, a draft and a post that is not there', async () => {
      const { service, engagementService, acting, publish } = await postsFixture();
      const text = await publish();
      const draft = expectOk(
        await service.create({ id: acting.ownerId, role: 'USER' }, acting, {
          payload: POLL,
          commentsEnabled: true,
          timing: { mode: 'draft' },
        })
      );

      expect(expectErr(await engagementService.vote(VOTER, text.id, 0)).code).toBe(
        ErrorCodes.VALIDATION_FAILED
      );
      expect(expectErr(await engagementService.vote(VOTER, draft.id, 0)).code).toBe(
        ErrorCodes.POST_NOT_FOUND
      );
      expect(
        expectErr(await engagementService.vote(VOTER, '00000000-0000-7000-8000-0000000012aa', 0))
          .code
      ).toBe(ErrorCodes.POST_NOT_FOUND);
    });

    it('refuses a vote on a closed poll and shows its results to everyone', async () => {
      let now = NOW;
      const { service, engagementService, publish } = await postsFixture(() => now);
      const poll = await publish({ ...POLL, closesAt: new Date(NOW + DAY).toISOString() });
      now = NOW + 2 * DAY;

      const failure = expectErr(await engagementService.vote(VOTER, poll.id, 0));
      const read = expectOk(await service.get(null, poll.id));

      expect(failure.code).toBe(ErrorCodes.POST_POLL_CLOSED);
      expect(read.body).toMatchObject({ closed: true, totalVotes: 0 });
    });

    it('refuses a banned voter with COMMENTS_BANNED and takes a shadow-banned vote silently', async () => {
      const { repositories, engagementService, publish, channel } = await postsFixture();
      const poll = await publish(POLL);
      const findActive = vi.spyOn(
        repositories.channelUserRestrictions as ChannelUserRestrictionRepositoryPort,
        'findActive'
      );
      findActive.mockResolvedValueOnce({
        ok: true,
        value: { kind: 'ban', reason: 'spam', expiresAt: null },
      } as never);

      const banned = expectErr(await engagementService.vote(VOTER, poll.id, 0));
      findActive.mockResolvedValueOnce({
        ok: true,
        value: { kind: 'shadow_ban', reason: null, expiresAt: null },
      } as never);
      const shadow = expectOk(await engagementService.vote(OTHER, poll.id, 0));

      expect(banned.code).toBe(ErrorCodes.COMMENTS_BANNED);
      expect(shadow.id).toBe(poll.id);
      expect(findActive).toHaveBeenCalledWith(channel.id, VOTER.id, expect.any(Date));
    });
  });

  describe('beacons', () => {
    it('counts an open once per viewer and day and a share click every time', async () => {
      const { engagementService, manage, acting, publish } = await postsFixture();
      const post = await publish();

      expectOk(await engagementService.recordOpen(VOTER, '10.0.0.1', post.id));
      expectOk(await engagementService.recordOpen(VOTER, '10.0.0.2', post.id));
      expectOk(await engagementService.recordOpen(null, '10.0.0.3', post.id));
      expectOk(await engagementService.recordOpen(null, '10.0.0.3', post.id));
      expectOk(await engagementService.recordShareClick(post.id));
      expectOk(await engagementService.recordShareClick(post.id));

      expect(
        expectOk(await manage.stats({ id: acting.ownerId, role: 'USER' }, acting, post.id))
      ).toMatchObject({ opens: 2, shareClicks: 2 });
    });

    it('answers POST_NOT_FOUND for a beacon on a post that is not there', async () => {
      const { engagementService } = await postsFixture();
      const absent = '00000000-0000-7000-8000-0000000012aa';

      expect(expectErr(await engagementService.recordOpen(null, 'x', absent)).code).toBe(
        ErrorCodes.POST_NOT_FOUND
      );
      expect(expectErr(await engagementService.recordShareClick(absent)).code).toBe(
        ErrorCodes.POST_NOT_FOUND
      );
    });
  });
});

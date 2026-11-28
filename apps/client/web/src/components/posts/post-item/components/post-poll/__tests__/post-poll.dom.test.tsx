import { screen } from '@testing-library/react';
import { ErrorCodes } from '@vp/errors';
import { CHANNEL_ID } from '@vp/web-testing';
import { answeredQuiz, openPoll, openQuiz, votedPoll } from '#app/__tests__/post-fixtures';
import { renderPosts } from '#app/__tests__/render-posts';

const POSTS_URL = `/channel/${CHANNEL_ID}?tab=posts`;

describe('apps/client/web: PostPoll', () => {
  it('sends the vote and turns the options into results', async () => {
    const calls: string[] = [];
    const { user } = await renderPosts(POSTS_URL, {
      posts: [openPoll()],
      voteResult: votedPoll(),
      calls,
    });

    await user.click(await screen.findByRole('button', { name: 'Line 28' }));

    expect(await screen.findByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Your vote')).toBeInTheDocument();
    expect(screen.getByText('4 votes')).toBeInTheDocument();
    expect(calls.filter((call) => call.startsWith('PUT'))).toHaveLength(1);
  });

  it('asks a guest to sign in before it counts a vote', async () => {
    const calls: string[] = [];
    const { user } = await renderPosts(POSTS_URL, { guest: true, posts: [openPoll()], calls });

    await user.click(await screen.findByRole('button', { name: 'Line 15' }));

    expect(await screen.findByRole('dialog', { name: 'Sign in to vote' })).toBeInTheDocument();
    expect(calls.some((call) => call.startsWith('PUT'))).toBe(false);
  });

  it.each([ErrorCodes.POST_ALREADY_VOTED, ErrorCodes.POST_POLL_CLOSED])(
    'refetches and shows the results when the vote is answered %s',
    async (code) => {
      const { user } = await renderPosts(POSTS_URL, {
        posts: [openPoll()],
        voteResult: code,
        heldAfterVote: votedPoll(),
      });

      await user.click(await screen.findByRole('button', { name: 'Line 28' }));

      expect(await screen.findByText('75%')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Line 28' })).not.toBeInTheDocument();
    }
  );

  it.each([
    { answer: 1, outcome: 'You got it right' },
    { answer: 0, outcome: 'Not quite' },
  ])(
    'reveals the quiz answer and says "$outcome" for option $answer',
    async ({ answer, outcome }) => {
      const { user } = await renderPosts(POSTS_URL, {
        posts: [openQuiz()],
        voteResult: answeredQuiz(answer),
      });

      await user.click(await screen.findByRole('button', { name: answer === 1 ? '1929' : '1914' }));

      expect(await screen.findByText(outcome)).toBeInTheDocument();
      expect(screen.getByText('The first service ran in 1929.')).toBeInTheDocument();
      expect(screen.getByText('Correct answer')).toBeInTheDocument();
    }
  );

  it('shows the results of a closed poll the viewer never voted in, with no buttons', async () => {
    await renderPosts(POSTS_URL, {
      posts: [
        openPoll({
          options: [
            { text: 'Line 28', votes: 3 },
            { text: 'Line 15', votes: 1 },
          ],
          closed: true,
          totalVotes: 4,
        }),
      ],
    });

    expect(await screen.findByText('Voting has closed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Line 28' })).not.toBeInTheDocument();
  });

  it('hides the results until the viewer votes', async () => {
    await renderPosts(POSTS_URL, { posts: [openPoll()] });

    expect(await screen.findByText('Results show after you vote')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});

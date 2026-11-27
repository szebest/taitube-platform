import { screen, within } from '@testing-library/react';
import { getPostStats } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { managedPost, STATS } from '#app/features/posts/__tests__/posts-api.fixture';
import { renderPosts } from '#app/features/posts/__tests__/render-posts';

const options = [
  { text: 'Lighting', votes: 3 },
  { text: 'Audio', votes: 1 },
];
const POLL = {
  kind: 'poll',
  question: 'Next topic?',
  options,
  closesAt: null,
  closed: false,
  votedIndex: null,
  totalVotes: 4,
} as const;

async function openStats(posts = [managedPost(POLL)], stats = {}) {
  const rendered = await renderPosts('/posts', { posts, stats: { ...STATS, ...stats } });
  await rendered.user.click(screen.getByRole('button', { name: /Actions for/ }));
  await rendered.user.click(await screen.findByRole('menuitem', { name: 'Stats' }));
  return { ...rendered, dialog: await screen.findByRole('dialog', { name: 'Post stats' }) };
}

describe('apps/client/studio: PostStatsSheet', () => {
  it('shows the four figures of a post', async () => {
    const { dialog } = await openStats();

    expect(await within(dialog).findByText('120')).toBeInTheDocument();
    expect(within(dialog).getByText('Share clicks')).toBeInTheDocument();
    expect(within(dialog).getByText('31')).toBeInTheDocument();
  });

  it('draws the votes of each option as a bar of the whole', async () => {
    const { dialog } = await openStats(undefined, { votesByOption: [3, 1] });

    expect(await within(dialog).findByText('3 votes')).toBeInTheDocument();
    expect(within(dialog).getByRole('progressbar', { name: 'Lighting' })).toHaveAttribute(
      'aria-valuenow',
      '75'
    );
    expect(within(dialog).getByRole('progressbar', { name: 'Audio' })).toHaveAttribute(
      'aria-valuenow',
      '25'
    );
  });

  it.each([
    { scenario: 'a share of right answers', share: 0.5, shown: /Answered correctly:\s*50%/ },
    { scenario: 'a quiz nobody answered', share: null, shown: /Nobody has answered yet/ },
  ])('shows $scenario for a quiz', async ({ share, shown }) => {
    const quiz = managedPost({ ...POLL, kind: 'quiz', correctIndex: 0, explanation: null });
    const { dialog } = await openStats([quiz], { votesByOption: [3, 1], quizCorrectShare: share });

    expect(await within(dialog).findByText(shown)).toBeInTheDocument();
  });

  it('shows no votes for a post without options', async () => {
    const { dialog } = await openStats([managedPost()]);

    await within(dialog).findByText('120');
    expect(within(dialog).queryByText('Votes by option')).toBeNull();
  });

  it('says when the figures could not be loaded', async () => {
    const rendered = await renderPosts('/posts', { posts: [managedPost()] });
    apiServer.use(mockEndpoint(getPostStats, () => problemReply(ErrorCodes.FORBIDDEN)));

    await rendered.user.click(screen.getByRole('button', { name: /Actions for/ }));
    await rendered.user.click(await screen.findByRole('menuitem', { name: 'Stats' }));

    expect(await screen.findByText('The stats could not be loaded.')).toBeInTheDocument();
  });
});

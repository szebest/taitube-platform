import { screen, waitFor, within } from '@testing-library/react';
import { ErrorCodes } from '@vp/errors';
import { renderRoute } from '@vp/web-testing/dom';
import { managedPost } from '#app/features/posts/__tests__/posts-api.fixture';
import { renderPosts } from '#app/features/posts/__tests__/render-posts';
import { getRouter } from '#app/router';

const text = (id: string, words: string, patch = {}) =>
  managedPost({ kind: 'text', text: words }, { id, ...patch });

const A = '0190c3a0-5e1d-7000-8000-0000000fd001';
const B = '0190c3a0-5e1d-7000-8000-0000000fd002';
const C = '0190c3a0-5e1d-7000-8000-0000000fd003';

const POSTS = [
  text(A, 'Published words'),
  text(B, 'Drafted words', { status: 'draft', publishedAt: null }),
  text(C, 'Scheduled words', {
    status: 'scheduled',
    publishedAt: null,
    publishAt: '2026-12-24T18:30:00.000Z',
  }),
];

const rowOf = (words: string) => screen.getByText(words).closest('tr') as HTMLElement;

async function openMenu(user: Awaited<ReturnType<typeof renderPosts>>['user'], words: string) {
  await user.click(within(rowOf(words)).getByRole('button', { name: /Actions for/ }));
}

describe('apps/client/studio: /posts', () => {
  it('sends a guest to the studio sign-in, back to the page once signed in', async () => {
    const { router } = await renderRoute(getRouter, '/posts');

    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toMatchObject({ redirect: '/posts' });
  });

  it('lists the posts in every stage, each with its kind, stage and replies', async () => {
    await renderPosts('/posts', { posts: POSTS.slice(0, 2) });

    expect(within(rowOf('Published words')).getByText('Published')).toBeInTheDocument();
    expect(within(rowOf('Drafted words')).getByText('Draft')).toBeInTheDocument();
    expect(within(rowOf('Drafted words')).getByText('Text')).toBeInTheDocument();
  });

  it('opens from the navigation, marked as the page shown', async () => {
    await renderPosts();

    const nav = screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement;
    expect(within(nav).getByRole('link', { name: 'Posts' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('keeps an absent filter absent in the address and narrows the list when one is chosen', async () => {
    const { router, user, requests } = await renderPosts('/posts', { posts: POSTS });
    expect(router.state.location.search).toEqual({});

    await user.click(screen.getByRole('radio', { name: 'Drafts' }));

    await screen.findByText('Drafted words');
    expect(screen.queryByText('Published words')).toBeNull();
    expect(router.state.location.search).toEqual({ status: 'draft' });
    expect(requests.lists.at(-1)).toMatchObject({ status: 'draft' });

    await user.click(screen.getByRole('radio', { name: 'All' }));
    await screen.findByText('Published words');
    expect(router.state.location.search).toEqual({ status: undefined });
  });

  it('starts on the filter in the address', async () => {
    await renderPosts('/posts?status=scheduled', { posts: POSTS });

    expect(await screen.findByText('Scheduled words')).toBeInTheDocument();
    expect(screen.queryByText('Published words')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Scheduled' })).toBeChecked();
  });

  it('loads the next page on request', async () => {
    const { user, requests } = await renderPosts('/posts', { posts: POSTS });
    expect(screen.queryByText('Scheduled words')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Scheduled words')).toBeInTheDocument();
    expect(requests.lists.at(-1)).toMatchObject({ cursor: '2' });
  });

  it('pins a published post and marks it', async () => {
    const { user, requests } = await renderPosts('/posts', { posts: [POSTS[0] ?? managedPost()] });

    await openMenu(user, 'Published words');
    await user.click(await screen.findByRole('menuitem', { name: 'Pin to the top' }));

    await waitFor(() => expect(requests.pinned).toEqual([A]));
    expect(await within(rowOf('Published words')).findByLabelText('Pinned')).toBeInTheDocument();
  });

  it('says why a fourth pin is refused', async () => {
    const { user } = await renderPosts('/posts', {
      posts: [POSTS[0] ?? managedPost()],
      pinFailure: ErrorCodes.POST_PIN_LIMIT,
    });

    await openMenu(user, 'Published words');
    await user.click(await screen.findByRole('menuitem', { name: 'Pin to the top' }));

    expect(
      await screen.findByText('A channel can pin up to 3 posts. Unpin one first.')
    ).toBeInTheDocument();
    expect(within(rowOf('Published words')).queryByLabelText('Pinned')).toBeNull();
  });

  it('unpins a pinned post', async () => {
    const { user, requests } = await renderPosts('/posts', {
      posts: [text(A, 'Published words', { pinned: true })],
    });

    await openMenu(user, 'Published words');
    await user.click(await screen.findByRole('menuitem', { name: 'Unpin' }));

    await waitFor(() => expect(requests.unpinned).toEqual([A]));
  });

  it.each([
    {
      stage: 'published',
      words: 'Published words',
      items: ['Edit', 'Pin to the top', 'Stats', 'Delete'],
    },
    { stage: 'draft', words: 'Drafted words', items: ['Edit', 'Delete'] },
  ])('offers a $stage post $items', async ({ words, items }) => {
    const { user } = await renderPosts('/posts', { posts: POSTS.slice(0, 2) });

    await openMenu(user, words);

    expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toEqual(items);
  });

  it('deletes a post only after asking', async () => {
    const { user, requests } = await renderPosts('/posts', { posts: POSTS.slice(0, 2) });

    await openMenu(user, 'Drafted words');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(requests.deleted).toEqual([]);
    await user.click(await screen.findByRole('button', { name: 'Delete post' }));

    await waitFor(() => expect(requests.deleted).toEqual([B]));
    await waitFor(() => expect(screen.queryByText('Drafted words')).toBeNull());
  });

  it('opens the stats of a published post', async () => {
    const { user, requests } = await renderPosts('/posts', { posts: [POSTS[0] ?? managedPost()] });

    await openMenu(user, 'Published words');
    await user.click(await screen.findByRole('menuitem', { name: 'Stats' }));

    expect(await screen.findByText('120')).toBeInTheDocument();
    expect(requests.stats).toEqual([A]);
  });

  it('shows an empty list as an invitation to write', async () => {
    await renderPosts();

    expect(await screen.findByText('No posts here yet')).toBeInTheDocument();
  });
});

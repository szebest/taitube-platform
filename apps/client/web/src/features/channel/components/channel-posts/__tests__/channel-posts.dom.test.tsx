import { screen } from '@testing-library/react';
import { CHANNEL_ID } from '@vp/web-testing';
import { NEXT_POST_ID, post } from '#app/__tests__/post-fixtures';
import { renderPosts } from '#app/__tests__/render-posts';

const POSTS_URL = `/channel/${CHANNEL_ID}?tab=posts`;

describe('apps/client/web: channel posts tab', () => {
  it('lists the channel posts under the Posts tab', async () => {
    await renderPosts(POSTS_URL, {
      posts: [
        post({ pinned: true, body: { kind: 'text', text: 'Pinned news' } }),
        post({ id: NEXT_POST_ID, body: { kind: 'text', text: 'Later news' } }),
      ],
    });

    expect(await screen.findByText('Pinned news')).toBeInTheDocument();
    expect(screen.getByText('Later news')).toBeInTheDocument();
    expect(screen.getByText('Pinned')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Posts' })).toHaveAttribute('aria-current', 'page');
  });

  it('says so when the channel has no post', async () => {
    await renderPosts(POSTS_URL, { posts: [] });

    expect(await screen.findByText('No posts yet')).toBeInTheDocument();
  });

  it.each([
    { viewer: 'the owner', guest: false, shown: true },
    { viewer: 'a guest', guest: true, shown: false },
  ])('shows Create post to $viewer: $shown', async ({ guest, shown }) => {
    await renderPosts(POSTS_URL, { guest });

    await screen.findByText('A new episode is out');
    const link = screen.queryByRole('link', { name: 'Create post' });
    expect(link !== null).toBe(shown);
    if (link) {
      expect(link.getAttribute('href')).toMatch(/\/posts$/);
    }
  });
});

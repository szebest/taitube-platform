import { screen, waitFor } from '@testing-library/react';
import { POST_ID, post } from '#app/__tests__/post-fixtures';
import { renderPosts } from '#app/__tests__/render-posts';

const URL = `/post/${POST_ID}`;

describe('apps/client/web: PostPage', () => {
  it('shows the post under its channel heading, with the replies below it', async () => {
    await renderPosts(URL);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Post by The Creator' })
    ).toBeInTheDocument();
    expect(screen.getByText('A new episode is out')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /Replies/ })).toBeInTheDocument();
  });

  it('counts the open once per visit', async () => {
    const calls: string[] = [];
    await renderPosts(URL, { calls });

    await screen.findByText('A new episode is out');

    await waitFor(() =>
      expect(calls.filter((call) => call === `POST /v1/posts/${POST_ID}/open`)).toHaveLength(1)
    );
  });

  it('shows the reply count of the post itself, not as a link to itself', async () => {
    await renderPosts(URL);

    await screen.findByText('A new episode is out');

    expect(screen.queryByRole('link', { name: /replies/ })).not.toBeInTheDocument();
  });

  it('says replies are off and asks for none when the channel turned them off', async () => {
    const calls: string[] = [];
    await renderPosts(URL, { posts: [post({ commentsEnabled: false })], calls });

    expect(await screen.findByText('Replies are turned off for this post')).toBeInTheDocument();
    expect(calls.some((call) => call.endsWith('/comments'))).toBe(false);
  });
});

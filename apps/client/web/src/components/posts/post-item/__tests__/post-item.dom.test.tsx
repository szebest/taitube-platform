import { screen } from '@testing-library/react';
import { CHANNEL_ID } from '@vp/web-testing';
import { POST_ID, post } from '#app/__tests__/post-fixtures';
import { renderPosts } from '#app/__tests__/render-posts';

const POSTS_URL = `/channel/${CHANNEL_ID}?tab=posts`;

describe('apps/client/web: PostItem', () => {
  it('likes a post for a signed-in viewer and takes the count the API answered', async () => {
    const calls: string[] = [];
    const { user } = await renderPosts(POSTS_URL, { calls });

    await user.click(await screen.findByRole('button', { name: 'Like' }));

    const liked = await screen.findByRole('button', { name: 'Unlike' });
    expect(liked).toHaveAttribute('aria-pressed', 'true');
    expect(liked).toHaveTextContent('4');
    expect(calls).toContain(`PUT /v1/posts/${POST_ID}/reactions`);
  });

  it('unlikes a liked post', async () => {
    const calls: string[] = [];
    const { user } = await renderPosts(POSTS_URL, {
      posts: [post({ likedByViewer: true, likeCount: 4 })],
      calls,
    });

    await user.click(await screen.findByRole('button', { name: 'Unlike' }));

    expect(await screen.findByRole('button', { name: 'Like' })).toHaveTextContent('3');
    expect(calls).toContain(`DELETE /v1/posts/${POST_ID}/reactions`);
  });

  it('asks a guest to sign in before it counts a like', async () => {
    const calls: string[] = [];
    const { user } = await renderPosts(POSTS_URL, { guest: true, calls });

    await user.click(await screen.findByRole('button', { name: 'Like' }));

    expect(await screen.findByRole('dialog', { name: 'Sign in to like this' })).toBeInTheDocument();
    expect(calls.some((call) => call.startsWith('PUT'))).toBe(false);
  });

  it('links the reply count to the post page', async () => {
    await renderPosts(POSTS_URL, { posts: [post({ commentsCount: 2 })] });

    expect(await screen.findByRole('link', { name: '2 replies' })).toHaveAttribute(
      'href',
      `/post/${POST_ID}`
    );
  });

  it('leaves the reply count out when replies are off', async () => {
    await renderPosts(POSTS_URL, { posts: [post({ commentsEnabled: false })] });

    await screen.findByRole('button', { name: 'Like' });
    expect(screen.queryByRole('link', { name: /repl/ })).not.toBeInTheDocument();
  });

  it.each([
    { fields: { isEdited: true }, shown: '(edited)' },
    { fields: { pinned: true }, shown: 'Pinned' },
  ])('marks a post as $shown', async ({ fields, shown }) => {
    await renderPosts(POSTS_URL, { posts: [post(fields)] });

    expect(await screen.findByText(shown)).toBeInTheDocument();
  });
});

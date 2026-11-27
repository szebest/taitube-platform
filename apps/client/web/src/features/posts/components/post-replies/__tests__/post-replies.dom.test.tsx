import { screen, waitFor } from '@testing-library/react';
import { comment } from '@vp/web-testing';
import { POST_ID } from '#app/__tests__/post-fixtures';
import { renderPosts } from '#app/__tests__/render-posts';

const URL = `/post/${POST_ID}`;

const REPLY = comment({
  content: 'The 28 is the best line',
  target: { type: 'post', id: POST_ID },
  videoId: null,
});

describe('apps/client/web: PostReplies', () => {
  it('counts and lists the replies under the post', async () => {
    await renderPosts(URL, { comments: [REPLY] });

    expect(await screen.findByText('The 28 is the best line')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Replies/ })).toHaveTextContent('Replies · 1');
    expect(screen.getByText('Ines Carvalho')).toBeInTheDocument();
  });

  it('says so when nobody has replied', async () => {
    await renderPosts(URL, { comments: [] });

    expect(await screen.findByText('No replies yet')).toBeInTheDocument();
  });

  it("sends a signed-in viewer's reply to the post and clears the composer", async () => {
    const calls: string[] = [];
    const { user } = await renderPosts(URL, { comments: [REPLY], calls });

    const field = await screen.findByRole('textbox', { name: 'Add a comment' });
    await user.type(field, 'Agreed');
    await user.click(await screen.findByRole('button', { name: 'Comment' }));

    await waitFor(() => expect(field).toHaveValue(''));
    expect(calls).toContain(`POST /v1/posts/${POST_ID}/comments`);
  });

  it('asks a guest to sign in instead of offering a composer', async () => {
    const { user } = await renderPosts(URL, { guest: true, comments: [REPLY] });

    expect(await screen.findByText('Sign in to join the discussion')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Add a comment' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('dialog', { name: 'Sign in to comment' })).toBeInTheDocument();
  });
});

import { screen, within } from '@testing-library/react';
import { COMMENT_ID, inboxComment, VIDEO_ID } from '@vp/web-testing';
import { renderInbox } from '#app/features/comments/__tests__/render-inbox';

const REPLY = inboxComment({
  id: '0190c3a0-5e1d-7000-8000-00000000d002',
  parentId: COMMENT_ID,
  content: 'A reply',
});

async function openReply() {
  const rendered = await renderInbox('/comments', [[REPLY]]);
  const row = within(screen.getByText('A reply').closest('tr') as HTMLElement);
  await rendered.user.click(row.getByRole('button', { name: 'Reply' }));
  return { ...rendered, row };
}

describe('apps/client/studio: InboxReply', () => {
  it('posts nothing blank, and answers a reply under its thread root', async () => {
    const { user, row, requests } = await openReply();
    const post = row.getByRole('button', { name: 'Post reply' });
    expect(post).toBeDisabled();

    await user.type(row.getByRole('textbox', { name: 'Your reply' }), '  Thanks  ');
    await user.click(post);

    await vi.waitFor(() =>
      expect(requests.replies).toEqual([
        { videoId: VIDEO_ID, body: { content: 'Thanks', parentId: COMMENT_ID } },
      ])
    );
  });

  it('closes on cancel', async () => {
    const { user, row } = await openReply();

    await user.click(row.getByRole('button', { name: 'Cancel' }));

    expect(row.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

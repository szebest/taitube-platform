import { screen, within } from '@testing-library/react';
import { inboxComment } from '@vp/web-testing';
import { renderInbox } from '#app/features/comments/__tests__/render-inbox';

const COMMENT = inboxComment({ content: 'Great video' });
const REPLIES = [
  {
    id: '0190c3a0-5e1d-7000-8000-00000000a001',
    title: 'Thanks',
    body: 'Thank you for watching!',
    position: 0,
  },
  {
    id: '0190c3a0-5e1d-7000-8000-00000000a002',
    title: 'Where',
    body: 'Filmed in Alfama.',
    position: 1,
  },
];

async function openReply(replies = REPLIES) {
  const rendered = await renderInbox('/comments', [[COMMENT]], {}, replies);
  const row = within(screen.getByText('Great video').closest('tr') as HTMLElement);
  await rendered.user.click(row.getByRole('button', { name: 'Reply' }));
  return { ...rendered, row };
}

describe('apps/client/studio: SavedRepliesPicker', () => {
  it('loads the saved replies only when the popover opens', async () => {
    const { user, row, requests } = await openReply();
    expect(requests.savedRepliesAsked).toBe(0);

    await user.click(row.getByRole('button', { name: 'Saved replies' }));

    expect(await screen.findByText('Filmed in Alfama.')).toBeInTheDocument();
    expect(requests.savedRepliesAsked).toBe(1);
  });

  it('puts the reply picked in the draft, to be edited and sent', async () => {
    const { user, row, requests } = await openReply();

    await user.click(row.getByRole('button', { name: 'Saved replies' }));
    await user.click(await screen.findByRole('button', { name: /Thanks/ }));
    const draft = row.getByRole('textbox', { name: 'Your reply' });
    expect(draft).toHaveValue('Thank you for watching!');
    await user.type(draft, ' See you Friday.');
    await user.click(row.getByRole('button', { name: 'Post reply' }));

    await vi.waitFor(() =>
      expect(requests.replies.map(({ body }) => body)).toEqual([
        expect.objectContaining({ content: 'Thank you for watching! See you Friday.' }),
      ])
    );
  });

  it('appends to what is already written', async () => {
    const { user, row } = await openReply();

    await user.type(row.getByRole('textbox', { name: 'Your reply' }), 'Hi!');
    await user.click(row.getByRole('button', { name: 'Saved replies' }));
    await user.click(await screen.findByRole('button', { name: /Where/ }));

    expect(row.getByRole('textbox', { name: 'Your reply' })).toHaveValue('Hi! Filmed in Alfama.');
  });

  it('says when there are none', async () => {
    const { user, row } = await openReply([]);

    await user.click(row.getByRole('button', { name: 'Saved replies' }));

    expect(await screen.findByText('No saved replies yet.')).toBeInTheDocument();
  });
});

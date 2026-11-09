import { screen, within } from '@testing-library/react';
import { COMMENT_ID, inboxComment } from '@vp/web-testing';
import { renderInbox } from '#app/features/comments/__tests__/render-inbox';

const REPLY_ID = '0190c3a0-5e1d-7000-8000-00000000d002';
const TOP = inboxComment({ isPinned: true });
const REPLY = inboxComment({ id: REPLY_ID, parentId: COMMENT_ID, content: 'A reply' });

const rowOf = (text: string) => within(screen.getByText(text).closest('tr') as HTMLElement);

describe('apps/client/studio: InboxCommentActions', () => {
  it.each([
    { press: 'Heart', write: `heart ${COMMENT_ID}` },
    { press: 'Pin', write: `unpin ${COMMENT_ID}` },
  ])('toggles the $press of a top-level comment', async ({ press, write }) => {
    const { user, requests } = await renderInbox('/comments', [[TOP]]);

    await user.click(rowOf(TOP.content).getByRole('button', { name: press }));

    await vi.waitFor(() => expect(requests.writes).toEqual([write]));
  });

  it('offers no pin on a reply', async () => {
    await renderInbox('/comments', [[REPLY]]);

    expect(rowOf('A reply').getByRole('button', { name: 'Heart' })).toBeInTheDocument();
    expect(rowOf('A reply').queryByRole('button', { name: 'Pin' })).not.toBeInTheDocument();
  });
});

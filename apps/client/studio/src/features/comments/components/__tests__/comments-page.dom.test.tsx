import { screen } from '@testing-library/react';
import { renderInbox } from '#app/features/comments/__tests__/render-inbox';

describe('apps/client/studio: CommentsPage', () => {
  it('switches the filter, says so in the address and asks the API for it', async () => {
    const { user, router, requests } = await renderInbox('/comments');

    await user.click(screen.getByRole('radio', { name: 'Unanswered' }));

    await vi.waitFor(() => expect(router.state.location.searchStr).toBe('?filter=unanswered'));
    expect(requests.lists.at(-1)).toEqual({ filter: 'unanswered', cursor: null });
  });
});

import { screen } from '@testing-library/react';

import {
  page,
  renderSearch,
  searchReply,
  videoResult,
} from '#app/features/search/__tests__/search-fixtures';

describe('apps/client/web: SearchSortMenu', () => {
  it.each([
    { label: 'Upload date', sort: 'date' },
    { label: 'View count', sort: 'views' },
  ])('sorts by $label, replacing the URL and asking again', async ({ label, sort }) => {
    const asked: string[] = [];
    const { user, router } = await renderSearch('/search?q=react', [
      searchReply(() => page([videoResult()]), asked),
    ]);
    const before = router.history.length;

    await user.click(await screen.findByRole('button', { name: 'Relevance' }));
    await user.click(await screen.findByRole('menuitemradio', { name: label }));

    expect(await screen.findByRole('button', { name: label })).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ q: 'react', sort });
    expect(router.history.length).toBe(before);
    expect(asked).toContain(`q=react&type=all&sort=${sort}&limit=30`);
  });

  it('shows the sort of the URL as chosen, and relevance for one it does not know', async () => {
    const { user } = await renderSearch('/search?q=react&sort=oldest', [
      searchReply(() => page([videoResult()])),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Relevance' }));

    expect(await screen.findByRole('menuitemradio', { name: 'Relevance' })).toBeChecked();
  });
});

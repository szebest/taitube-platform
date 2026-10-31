import { screen, waitFor } from '@testing-library/react';

import { historyItem } from '#app/features/library/__tests__/library-fixtures';
import { renderLibrary, useLibraryClock } from '#app/features/library/__tests__/render-library';

describe('apps/client/web: LibraryToolbar', () => {
  useLibraryClock();

  it('writes what is typed into the filter to `q`, replacing the history entry', async () => {
    const { user, router } = await renderLibrary('/feed/history', {
      history: [historyItem(1, { title: 'Tram ride' }), historyItem(2, { title: 'Old film' })],
    });
    const filter = await screen.findByRole('searchbox', { name: 'Filter watch history' });
    const entries = window.history.length;

    await user.type(filter, 'old');

    await waitFor(() => expect(router.state.location.search).toMatchObject({ q: 'old' }));
    expect(screen.queryByRole('link', { name: 'Tram ride' })).toBeNull();
    expect(window.history.length).toBe(entries);
  });

  it('starts the filter from `q`', async () => {
    await renderLibrary('/feed/history?q=tram');

    expect(await screen.findByRole('searchbox', { name: 'Filter watch history' })).toHaveValue(
      'tram'
    );
  });

  it('has no filter on the searches tab', async () => {
    await renderLibrary('/feed/history?tab=searches');

    expect(await screen.findByRole('button', { name: 'Clear all searches' })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it.each([
    { saved: true, checked: true },
    { saved: false, checked: false },
  ])('shows the pause the account holds ($saved)', async ({ saved, checked }) => {
    await renderLibrary('/feed/history', { historyPaused: saved });

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Pause watch and search history' })).toHaveProperty(
        'ariaChecked',
        String(checked)
      )
    );
  });
});

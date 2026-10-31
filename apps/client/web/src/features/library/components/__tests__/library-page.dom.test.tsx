import { screen } from '@testing-library/react';

import { historyItem, searchItem } from '../../__tests__/library-fixtures';
import { renderLibrary, useLibraryClock } from '../../__tests__/render-library';

describe('apps/client/web: LibraryPage', () => {
  useLibraryClock();

  it('opens on the history tab and loads only the open tab', async () => {
    const calls: string[] = [];

    await renderLibrary('/feed/history', { history: [historyItem(1)], calls });

    expect(await screen.findByRole('tab', { name: 'Watch history' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(await screen.findByRole('link', { name: 'Video 1' })).toBeInTheDocument();
    expect(calls).not.toContain('GET /v1/me/searches');
  });

  it.each([
    { tab: 'searches', name: 'Searches', call: 'GET /v1/me/searches' },
    { tab: 'liked', name: 'Liked', call: 'GET /v1/me/liked-videos' },
    { tab: 'comments', name: 'Comments', call: 'GET /v1/me/comments' },
  ])('opens the $tab tab from the URL and asks only for its rows', async ({ tab, name, call }) => {
    const calls: string[] = [];

    await renderLibrary(`/feed/history?tab=${tab}`, { calls });

    expect(await screen.findByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
    expect(calls).not.toContain('GET /v1/me/history');
    expect(calls).toContain(call);
  });

  it('changes tab by replacing the history entry', async () => {
    const { user, router } = await renderLibrary('/feed/history', {
      history: [historyItem(1)],
      searches: [searchItem(1, 'tram')],
    });
    await screen.findByRole('link', { name: 'Video 1' });
    const entries = window.history.length;

    await user.click(screen.getByRole('tab', { name: 'Searches' }));

    expect(await screen.findByRole('link', { name: 'tram' })).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ tab: 'searches' });
    expect(window.history.length).toBe(entries);
  });

  it('falls back to the history tab for a tab it does not know', async () => {
    await renderLibrary('/feed/history?tab=videos');

    expect(await screen.findByRole('tab', { name: 'Watch history' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});

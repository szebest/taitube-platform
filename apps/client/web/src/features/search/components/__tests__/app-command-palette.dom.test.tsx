import { screen, within } from '@testing-library/react';

import {
  channelHit,
  openPalette,
  page,
  playlistResult,
  searchReply,
  suggestionsReply,
  videoResult,
} from '#app/features/search/__tests__/search-fixtures';

describe('apps/client/web: app command palette', () => {
  it.each([
    { url: '/', shown: '' },
    { url: '/search?q=lofi', shown: 'lofi' },
  ])('opens on $url with the words of the page it is on', async ({ url, shown }) => {
    const { field } = await openPalette(url);

    expect(field).toHaveValue(shown);
  });

  it('searches for the trimmed words, from the first row or Enter, and closes', async () => {
    const { user, router, field } = await openPalette();

    await user.type(field, '  lofi beats ');

    expect(screen.getByRole('option', { name: 'Search for lofi beats' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await user.keyboard('{Enter}');

    expect(router.state.location.pathname).toBe('/search');
    expect(router.state.location.search).toEqual({ q: 'lofi beats' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('goes to a place of the shell that matches by name', async () => {
    const { user, router, field } = await openPalette();

    await user.type(field, 'tren');
    const places = screen.getByRole('group', { name: 'Go to' });
    await user.click(within(places).getByRole('option', { name: 'Trending' }));

    expect(router.state.location.pathname).toBe('/feed/trending');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers every place and no search before a word is typed', async () => {
    await openPalette();

    expect(screen.queryByRole('group', { name: 'Search' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Go to' }))
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['Home', 'Shorts', 'Trending', 'Live']);
  });

  it('groups the results of the words typed and opens the one chosen with the keyboard alone', async () => {
    const { user, router, field } = await openPalette('/', [
      searchReply(() => page([videoResult(), channelHit(), playlistResult()])),
      suggestionsReply([{ type: 'query', text: 'react hooks' }]),
    ]);

    await user.type(field, 're');

    for (const name of ['Suggestions', 'Videos', 'Channels', 'Playlists']) {
      expect(await screen.findByRole('group', { name })).toBeInTheDocument();
    }

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(router.state.location.pathname).toMatch(/^\/watch\//);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches the theme without a reload, and lists no action for a page that does not exist', async () => {
    const { user, field } = await openPalette();

    await user.type(field, 'nocturne');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(decodeURIComponent(document.cookie)).toContain('"theme":"nocturne"');

    await user.keyboard('/');
    await user.type(await screen.findByRole('combobox'), 'history');

    expect(screen.queryByRole('option', { name: 'Open History' })).not.toBeInTheDocument();
  });
});

import { screen, within } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

async function openPalette(url = '/') {
  const rendered = await renderRoute(getRouter, url, { handlers: loaderApi() });
  await rendered.user.keyboard('/');
  return { ...rendered, field: screen.getByRole('combobox') };
}

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
});

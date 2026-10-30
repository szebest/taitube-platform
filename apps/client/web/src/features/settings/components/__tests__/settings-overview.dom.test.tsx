import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

const renderOverview = (url = '/settings') => renderRoute(getRouter, url);

const search = () => screen.getByRole('searchbox', { name: 'Search settings' });

describe('apps/client/web: the settings overview', () => {
  it('shows a card for each section, the page under appearance left out', async () => {
    await renderOverview();

    const cards = await screen.findAllByRole('link', {
      name: /Theme, mode, accent|Quality, speed|Language you read/,
    });

    expect(cards.length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Every token set/ })).toBeNull();
  });

  it('finds the corners row for "corners" and opens the advanced page at it', async () => {
    const { user, router } = await renderOverview();

    await user.type(await screen.findByRole('searchbox', { name: 'Search settings' }), 'corners');
    await user.click(await screen.findByRole('link', { name: /Corners/ }));

    expect(router.state.location.pathname).toBe('/settings/appearance/advanced');
    expect(router.state.location.hash).toBe('radius');
    expect(await screen.findByRole('group', { name: 'Corners' })).toHaveAttribute(
      'data-highlighted'
    );
  });

  it('keeps the search in the URL, and answers a search that finds nothing', async () => {
    const { user, router } = await renderOverview();

    await user.type(await screen.findByRole('searchbox', { name: 'Search settings' }), 'zebra');

    expect(router.state.location.search).toEqual({ find: 'zebra' });
    expect(screen.getByText('No setting matches zebra')).toBeInTheDocument();
  });

  it('opens on the search a link carries', async () => {
    await renderOverview('/settings?find=captions');

    expect(await screen.findByRole('link', { name: /Captions on by default/ })).toBeInTheDocument();
    expect(search()).toHaveValue('captions');
  });
});

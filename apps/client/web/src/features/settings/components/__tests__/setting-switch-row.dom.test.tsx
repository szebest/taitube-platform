import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

describe('apps/client/web: a settings switch row', () => {
  it('is a switch named by the row label, with the row description beside it', async () => {
    await renderRoute(getRouter, '/settings/playback');

    const row = await screen.findByRole('group', { name: 'Stats overlay' });

    expect(screen.getByRole('switch', { name: 'Stats overlay' })).toBeInTheDocument();
    expect(row).toHaveTextContent('Show playback statistics over the video.');
  });
});

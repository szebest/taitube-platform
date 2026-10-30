import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

describe('apps/client/web: a settings row', () => {
  it('is named by its catalogue label and carries the id a search result links to', async () => {
    await renderRoute(getRouter, '/settings/playback');

    const row = await screen.findByRole('group', { name: 'Autoplay next' });

    expect(row).toHaveAttribute('id', 'autoplay-next');
  });

  it.each([
    { url: '/settings/playback#autoplay-next', highlighted: true },
    { url: '/settings/playback#speed', highlighted: false },
    { url: '/settings/playback', highlighted: false },
  ])('highlights the row $url names: $highlighted', async ({ url, highlighted }) => {
    await renderRoute(getRouter, url);

    const row = await screen.findByRole('group', { name: 'Autoplay next' });

    expect(row.hasAttribute('data-highlighted')).toBe(highlighted);
  });
});

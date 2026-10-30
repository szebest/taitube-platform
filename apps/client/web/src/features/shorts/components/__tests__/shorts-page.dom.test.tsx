import { screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { ShortsPage } from '../shorts-page';

describe('apps/client/web: ShortsPage', () => {
  it('shows its empty state as the page heading, with the way back to the home feed', async () => {
    const html = await renderPage(<ShortsPage />, AppProviders);
    document.body.innerHTML = html;

    expect(
      screen.getByRole('heading', { level: 1, name: 'Shorts will appear here' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse videos' })).toHaveAttribute('href', '/');
    expect(await axeViolations()).toEqual([]);
  });
});

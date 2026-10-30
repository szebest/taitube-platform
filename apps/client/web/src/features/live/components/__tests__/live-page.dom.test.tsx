import { screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { LivePage } from '../live-page';

describe('apps/client/web: LivePage', () => {
  it('shows its empty state as the page heading, with the way back to the home feed', async () => {
    const html = await renderPage(<LivePage />, AppProviders);
    document.body.innerHTML = html;

    expect(
      screen.getByRole('heading', { level: 1, name: 'Nothing is live right now' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse videos' })).toHaveAttribute('href', '/');
    expect(await axeViolations()).toEqual([]);
  });
});

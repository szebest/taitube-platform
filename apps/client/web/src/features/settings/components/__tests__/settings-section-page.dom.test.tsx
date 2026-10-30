import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';
import { holds, preferencesView } from '../../__tests__/preferences-fixtures';

describe('apps/client/web: a settings page', () => {
  it.each([
    { url: '/settings/language', back: 'Settings', href: '/settings' },
    { url: '/settings/appearance/advanced', back: 'Appearance', href: '/settings/appearance' },
  ])('leads back from $url to $href', async ({ url, back, href }) => {
    await renderRoute(getRouter, url);

    const links = await screen.findAllByRole('link', { name: back });

    expect(
      links.find((link) => link.getAttribute('data-slot') === 'settings-shell-back')
    ).toHaveAttribute('href', href);
  });

  it('says a section with no rows yet has none', async () => {
    await renderRoute(getRouter, '/settings/language');

    expect(await screen.findByText('Nothing to set in this section yet.')).toBeInTheDocument();
  });

  it('gives a signed-in viewer a section the account holds, in place of the prompt to sign in', async () => {
    await renderRoute(getRouter, '/settings/notifications', {
      handlers: [signInBrowser(), holds(preferencesView())],
    });

    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });
});

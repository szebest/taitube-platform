import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { holds, preferencesView } from '#app/features/settings/__tests__/preferences-fixtures';
import { getRouter } from '#app/router';

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

  it('gives a signed-in viewer a section the account holds, in place of the prompt to sign in', async () => {
    await renderRoute(getRouter, '/settings/notifications', {
      handlers: [signInBrowser(), holds(preferencesView())],
    });

    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });
});

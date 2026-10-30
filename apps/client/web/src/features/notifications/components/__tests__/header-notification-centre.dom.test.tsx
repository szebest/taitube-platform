import { screen, within } from '@testing-library/react';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/web: header notification centre', () => {
  it('has no bell for a guest', async () => {
    await renderRoute(getRouter, '/', { handlers: loaderApi() });

    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('opens its empty state from the bell, with the way to manage subscriptions', async () => {
    const { user, router } = await renderRoute(getRouter, '/', {
      handlers: [signInBrowser(), ...loaderApi()],
    });

    await user.click(await screen.findByRole('button', { name: 'Notifications' }));
    const panel = screen.getByRole('dialog', { name: 'Notifications' });

    expect(
      within(panel).getByRole('heading', { name: 'No notifications yet' })
    ).toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);

    await user.click(within(panel).getByRole('link', { name: 'Manage subscriptions' }));

    expect(router.state.location.pathname).toBe('/subscriptions');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
  });
});

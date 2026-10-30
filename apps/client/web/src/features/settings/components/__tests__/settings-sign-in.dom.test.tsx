import { screen, within } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

describe('apps/client/web: the settings sign-in prompt', () => {
  it('offers a guest one way on, which brings them back to the section', async () => {
    await renderRoute(getRouter, '/settings/privacy');

    const section = await screen.findByRole('region', { name: 'Privacy' });
    const signIn = within(section).getByRole('link', { name: 'Sign in' });

    expect(signIn).toHaveAttribute('href', '/login?redirect=%2Fsettings%2Fprivacy');
  });
});

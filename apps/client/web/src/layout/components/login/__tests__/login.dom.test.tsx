import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/web: login in the browser', () => {
  it('opens the account menu with the upload entry linking to the studio', async () => {
    const { user } = await renderRoute(getRouter, '/watch/not-a-video', {
      handlers: [signInBrowser(), ...loaderApi()],
    });

    await user.click(await screen.findByLabelText('settings'));

    expect(screen.getByRole('link', { name: 'Upload' })).toHaveAttribute(
      'href',
      'http://localhost:5174/upload'
    );
  });

  it('signs out without a reload, leaving a guest on the page', async () => {
    const { user } = await renderRoute(getRouter, '/watch/not-a-video', {
      handlers: [signInBrowser(), ...loaderApi()],
    });

    await user.click(await screen.findByLabelText('settings'));
    await user.click(screen.getByRole('button', { name: 'sign out' }));

    await vi.waitFor(() => expect(screen.queryByLabelText('settings')).not.toBeInTheDocument());
    expect(document.cookie).toBe('');
  });
});

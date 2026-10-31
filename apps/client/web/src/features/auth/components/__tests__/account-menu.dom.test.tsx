import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { STUDIO_URL } from '#app/config';
import { SYNC_CHANNEL } from '#app/sw/sync-messages';
import { getRouter } from '#app/router';

describe('apps/client/web: account menu', () => {
  it('offers a guest to sign in, and to come back here after', async () => {
    await renderRoute(getRouter, '/feed/trending', { handlers: loaderApi() });

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?redirect=%2Ffeed%2Ftrending'
    );
  });

  it("links a signed-in viewer to the studio's upload page, and offers to sign out", async () => {
    const { user } = await renderRoute(getRouter, '/feed/trending', {
      handlers: [signInBrowser(), ...loaderApi()],
    });

    await user.click(await screen.findByRole('button', { name: 'Account' }));

    expect(screen.getByRole('menuitem', { name: 'Upload' })).toHaveAttribute(
      'href',
      `${STUDIO_URL}/upload`
    );
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  });

  it("drops the worker's queued changes as the viewer signs out", async () => {
    const worker = new BroadcastChannel(SYNC_CHANNEL);
    const heard: unknown[] = [];
    worker.addEventListener('message', ({ data }) => heard.push(data));
    const { user } = await renderRoute(getRouter, '/feed/trending', {
      handlers: [signInBrowser(), ...loaderApi()],
    });

    await user.click(await screen.findByRole('button', { name: 'Account' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    await vi.waitFor(() => expect(heard).toContainEqual({ type: 'clear-queue' }));
    worker.close();
  });
});

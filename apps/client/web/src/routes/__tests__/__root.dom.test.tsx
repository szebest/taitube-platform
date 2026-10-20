import { screen } from '@testing-library/react';
import { OWNER_ID } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/web: root route in the browser', () => {
  it('switches theme and mode from the header menu with no reload, and keeps them for the next visit', async () => {
    const { user } = await renderRoute(getRouter, '/watch/not-a-video');
    expect(document.documentElement.dataset).toMatchObject({ theme: 'sand', mode: 'dark' });

    await user.click(screen.getByRole('button', { name: 'Appearance' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Nocturne' }));
    await user.click(screen.getByRole('button', { name: 'Appearance' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Light' }));

    expect(document.documentElement.dataset).toMatchObject({
      theme: 'nocturne',
      mode: 'light',
      radius: 'sharp',
    });
    expect(decodeURIComponent(document.cookie)).toContain('"theme":"nocturne","mode":"light"');
  });

  it.each([
    { viewer: 'a signed-in viewer', handlers: () => [signInBrowser()], locks: [OWNER_ID] },
    { viewer: 'a guest', handlers: () => [], locks: [] },
  ])('joins the user event stream for $viewer', async ({ handlers, locks }) => {
    const requested = vi.spyOn(navigator.locks, 'request');

    await renderRoute(getRouter, '/watch/not-a-video', { handlers: handlers() });

    expect(requested.mock.calls.map(([name]) => name)).toEqual(
      locks.map((userId) => `vp.user-events.${userId}`)
    );
  });
});

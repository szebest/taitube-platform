import { screen } from '@testing-library/react';
import { OWNER_ID } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/web: root route in the browser', () => {
  it('re-themes the document from the header menu and keeps the choice for the next visit', async () => {
    const { user } = await renderRoute(getRouter, '/watch/not-a-video');
    expect(document.documentElement.dataset.theme).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Theme: System' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Light' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.cookie).toBe('vp.theme=light');
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

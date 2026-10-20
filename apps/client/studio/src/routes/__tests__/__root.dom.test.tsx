import { OWNER_ID } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/studio: root route in the browser', () => {
  it.each([
    { viewer: 'a signed-in creator', handlers: () => [signInBrowser()], locks: [OWNER_ID] },
    { viewer: 'a guest', handlers: () => [], locks: [] },
  ])('joins the user event stream for $viewer', async ({ handlers, locks }) => {
    const requested = vi.spyOn(navigator.locks, 'request');

    await renderRoute(getRouter, '/no-such-page', { handlers: handlers() });

    expect(requested.mock.calls.map(([name]) => name)).toEqual(
      locks.map((userId) => `vp.user-events.${userId}`)
    );
  });
});

import { screen, within } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';
import { loaderApi } from '#app/__tests__/loader-api';
import { takeIntent } from '#app/lib/account-action/replay-intent';
import { getRouter } from '#app/router';

const VIDEO_ID = '0190c3a0-5e1d-7000-8000-000000000007';

function renderSignIn(search: string) {
  return renderRoute(getRouter, `/?modal=sign-in&${search}`, { handlers: loaderApi() });
}

describe('apps/client/web: the sign-in dialog', () => {
  afterEach(() => window.sessionStorage.clear());

  it.each([
    { reason: 'like', title: 'Sign in to like this' },
    { reason: 'subscribe', title: 'Sign in to subscribe to this channel' },
    { reason: 'queue', title: 'Sign in to build a queue' },
  ])('says why: $title', async ({ reason, title }) => {
    await renderSignIn(`reason=${reason}`);

    const dialog = await screen.findByRole('dialog', { name: title });

    expect(within(dialog).getByRole('button', { name: 'Not now' })).toBeInTheDocument();
  });

  it('signs in and comes back to the page the viewer was on', async () => {
    await renderSignIn(`reason=like&redirect=${encodeURIComponent('/watch/1?t=4')}`);

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?redirect=%2Fwatch%2F1%3Ft%3D4'
    );
  });

  it('keeps the intent for after the sign-in, once the viewer follows the link', async () => {
    const { user } = await renderSignIn(`reason=like&intent=like:${VIDEO_ID}&redirect=%2F`);

    await user.click(await screen.findByRole('link', { name: 'Sign in' }));

    expect(takeIntent('/')).toEqual({ kind: 'like', id: VIDEO_ID });
  });

  it('keeps no intent when it does not know the page to come back to', async () => {
    const { user } = await renderSignIn(`reason=like&intent=like:${VIDEO_ID}`);

    await user.click(await screen.findByRole('link', { name: 'Sign in' }));

    expect(takeIntent('/')).toBeUndefined();
  });

  it('closes on Not now and stays on the page', async () => {
    const { user, router } = await renderSignIn('reason=like');

    await user.click(await screen.findByRole('button', { name: 'Not now' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/');
  });
});

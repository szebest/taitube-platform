import {
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { api } from '@vp/web-testing';
import { type AppRouterContext, createAppRouter } from '../app-router';
import { createIdentityStore } from '../identity-store';
import { useSignOut, useSignOutAll } from '../use-sign-out';
import { SPEC_MESSAGES } from './spec-messages';

function SignOutButtons() {
  const signOut = useSignOut();
  const signOutAll = useSignOutAll();

  return (
    <>
      <button type="button" onClick={signOut}>
        Sign out
      </button>
      <button type="button" onClick={signOutAll}>
        Sign out of all
      </button>
    </>
  );
}

async function renderSignOut(cookies: string[], slot = 0) {
  for (const cookie of cookies) {
    // oxlint-disable-next-line unicorn/no-document-cookie -- the browser arrives signed in.
    document.cookie = `${cookie}; path=/`;
  }
  const routeTree = createRootRouteWithContext<AppRouterContext>()({ component: SignOutButtons });
  const router = createAppRouter(
    {
      routeTree,
      messages: SPEC_MESSAGES,
      apiBaseUrl: 'http://localhost:3000',
      pending: () => null,
    },
    {
      api,
      history: createMemoryHistory({ initialEntries: ['/'] }),
      identity: createIdentityStore({ identity: { slot }, prefixed: cookies.length > 1 }),
    }
  );
  const invalidate = vi.spyOn(router, 'invalidate');
  await router.load();
  render(<RouterProvider router={router} />);
  return { router, invalidate, user: userEvent.setup() };
}

const sessionCookies = () =>
  document.cookie.split('; ').filter((cookie) => cookie.startsWith('vp.session'));

describe('@vp/queries: useSignOut', () => {
  it('signs the last account out on both apps, and loads the routes again as a guest, with no reload', async () => {
    const { invalidate, user } = await renderSignOut(['vp.session=signed-in']);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
    expect(sessionCookies()).toEqual([]);
  });

  it("signs this tab's account out alone and moves the tab to the account left", async () => {
    const { router, user } = await renderSignOut(['vp.session.0=zero', 'vp.session.1=one'], 1);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    await vi.waitFor(() => expect(router.history.location.pathname).toBe('/'));
    expect(router.options.context.identity.read()).toEqual({
      identity: { slot: 0 },
      prefixed: false,
    });
    expect(sessionCookies()).toEqual(['vp.session.0=zero']);
  });

  it('signs every account out', async () => {
    const { invalidate, user } = await renderSignOut(['vp.session.0=zero', 'vp.session.1=one'], 1);

    await user.click(await screen.findByRole('button', { name: 'Sign out of all' }));

    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledOnce());
    expect(sessionCookies()).toEqual([]);
  });
});

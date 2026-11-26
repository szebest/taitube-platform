import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { account, api } from '@vp/web-testing';
import { type AppRouterContext, createAppRouter } from '../app-router';
import { createIdentityStore } from '../identity-store';
import { SESSION_KEY } from '../session';
import { hasSession } from '../session-functions';
import { announceSessionChange, useSessionSync } from '../session-sync';
import { SPEC_MESSAGES } from './spec-messages';

vi.mock(import('../session-functions'), async (importOriginal) => {
  const functions = await importOriginal();
  return { ...functions, hasSession: vi.fn(functions.hasSession) };
});

function Root() {
  useSessionSync();
  return <Outlet />;
}

const rootRoute = createRootRouteWithContext<AppRouterContext>()({ component: Root });
const routeTree = rootRoute.addChildren(
  ['/subscriptions', '/login'].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null })
  )
);

async function renderTab({ slot = 1, prefixed = true } = {}) {
  const router = createAppRouter(
    {
      routeTree,
      messages: SPEC_MESSAGES,
      apiBaseUrl: 'http://localhost:3000',
      pending: () => null,
    },
    {
      api,
      history: createMemoryHistory({ initialEntries: ['/subscriptions'] }),
      identity: createIdentityStore({ identity: { slot }, prefixed }),
    }
  );
  router.options.context.queryClient.setQueryData(SESSION_KEY, {
    status: 'signed-in',
    account: account(),
  });
  await router.load();
  render(<RouterProvider router={router} />, { container: document.body });
  return router;
}

/** Another tab of this origin, which hears every change a tab announces when this one does. */
function anotherTab() {
  const channel = new BroadcastChannel('vp.session-sync');
  const heard = vi.fn();
  channel.addEventListener('message', heard);
  onTestFinished(() => channel.close());
  return { heardOnce: () => vi.waitFor(() => expect(heard).toHaveBeenCalledOnce()) };
}

async function focusChecked() {
  window.dispatchEvent(new Event('focus'));
  await vi.waitFor(() => expect(hasSession).toHaveBeenCalledOnce());
  await vi.mocked(hasSession).mock.results[0]?.value;
}

describe('@vp/queries: session sync', () => {
  it.each([
    { scenario: 'its own slot signed out in another tab', slots: [1], pathname: '/login' },
    { scenario: 'every slot signed out in another tab', slots: [0, 1, 2], pathname: '/login' },
    { scenario: 'another slot signed out in another tab', slots: [0], pathname: '/subscriptions' },
  ])('sends a tab on slot 1 to $pathname for $scenario', async ({ slots, pathname }) => {
    const router = await renderTab();
    const tab = anotherTab();

    announceSessionChange({ type: 'signed-out', slots });
    await tab.heardOnce();

    await vi.waitFor(() => expect(router.state.location.pathname).toBe(pathname));
  });

  it("puts a one-account tab's links under the prefix once another tab adds an account", async () => {
    const router = await renderTab({ slot: 0, prefixed: false });
    const tab = anotherTab();

    announceSessionChange({ type: 'added', slot: 1 });
    await tab.heardOnce();

    expect(router.options.context.identity.read().prefixed).toBe(true);
  });

  it('sends a tab to /login on focus when the other app signed its slot out', async () => {
    // oxlint-disable-next-line unicorn/no-document-cookie -- slot 0 is still signed in, slot 1 is not.
    document.cookie = 'vp.session.0=still-here; path=/';
    const router = await renderTab();

    await focusChecked();
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'));

    expect(router.state.location.search).toMatchObject({ slot: '1' });
  });

  it.each([
    { scenario: 'another identity', entry: '/u/2/c/second/subscriptions', slot: 2, swapped: true },
    { scenario: 'its own identity', entry: '/u/1/login', slot: 1, swapped: false },
    { scenario: 'no prefix', entry: '/login', slot: 1, swapped: false },
  ])(
    'acts as $scenario when the history lands on an entry of it, with a cache of its own: $swapped',
    async ({ entry, slot, swapped }) => {
      const router = await renderTab();
      const { queryClient } = router.options.context;

      router.history.push(entry);

      expect(router.options.context.identity.read().identity.slot).toBe(slot);
      expect(router.options.context.queryClient !== queryClient).toBe(swapped);
    }
  );

  it('leaves a tab put on focus while its slot still holds a session', async () => {
    // oxlint-disable-next-line unicorn/no-document-cookie -- slot 1 is signed in.
    document.cookie = 'vp.session.1=still-here; path=/';
    const router = await renderTab();

    await focusChecked();

    expect(router.state.location.pathname).toBe('/subscriptions');
  });
});

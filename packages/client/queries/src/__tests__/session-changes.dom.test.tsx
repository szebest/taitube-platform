import { useQuery } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  useRouter,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { type Account, getAccount } from '@vp/api-contracts';
import { account, api, apiServer, mockEndpoint } from '@vp/web-testing';
import { heldReply } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { NO_ACCOUNTS, withSignedIn } from '../accounts';
import { type AppRouterContext, createAppRouter } from '../app-router';
import { createIdentityStore } from '../identity-store';
import { GUEST, SESSION_KEY, type Session } from '../session';
import { endSession, settleSession, switchIdentity } from '../session-changes';
import { SessionProvider } from '../session-provider';
import { useTabIdentity } from '../use-tab-identity';

function Who() {
  const { api: routerApi }: AppRouterContext = useRouter().options.context;
  const { data } = useQuery({ queryKey: ['who'], queryFn: () => routerApi.me.getAccount() });
  return <p>{data ? `Signed in as ${data.channel.displayName}` : 'Loading'}</p>;
}

/** What each app root mounts: the session keyed by the tab's identity. */
function Root() {
  const { identity } = useTabIdentity();
  return (
    <SessionProvider session={GUEST} identity={identity}>
      <Outlet />
    </SessionProvider>
  );
}

const rootRoute = createRootRouteWithContext<AppRouterContext>()({ component: Root });
const routeTree = rootRoute.addChildren([
  ...['/subscriptions', '/login'].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null })
  ),
  createRoute({ getParentRoute: () => rootRoute, path: '/who', component: Who }),
]);

async function routerAt(
  url: string,
  { session, slot = 0 }: { session?: Session; slot?: number } = {}
) {
  const router = createAppRouter(
    {
      routeTree,
      apiBaseUrl: 'http://localhost:3000',
      pending: () => null,
    },
    {
      api,
      history: createMemoryHistory({ initialEntries: [url] }),
      identity: createIdentityStore({ identity: { slot }, prefixed: slot > 0 }),
    }
  );
  const { queryClient } = router.options.context;
  if (session) queryClient.setQueryData(SESSION_KEY, session);
  queryClient.setQueryData(['videos', 'mine'], ['the last viewer']);
  await router.load();
  return { router, queryClient };
}

const SIGNED_IN: Session = { status: 'signed-in', account: account() };

describe('@vp/queries: session changes', () => {
  it('sends a signed-in viewer whose session ended to /login for that slot, and back here after, as a guest', async () => {
    const { router, queryClient } = await routerAt('/subscriptions?tab=new', {
      session: SIGNED_IN,
      slot: 2,
    });

    endSession(router, 2);
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'));

    expect(router.state.location.search).toEqual({
      redirect: '/subscriptions?tab=new',
      reason: 'expired',
      slot: '2',
    });
    expect(router.options.context.queryClient).not.toBe(queryClient);
    expect(router.options.context.queryClient.getQueryData(SESSION_KEY)).toEqual(GUEST);
    expect(router.options.context.queryClient.getQueryData(['videos', 'mine'])).toBeUndefined();
  });

  it.each([
    { scenario: "a guest's 401", session: GUEST, slot: 0 },
    { scenario: 'a 401 for a slot this tab has left', session: SIGNED_IN, slot: 1 },
  ])('leaves $scenario a refusal, where it happened', async ({ session, slot }) => {
    const { router, queryClient } = await routerAt('/subscriptions', { session });

    endSession(router, slot);

    expect(router.state.location.pathname).toBe('/subscriptions');
    expect(router.options.context.queryClient).toBe(queryClient);
    expect(queryClient.getQueryData(['videos', 'mine'])).toEqual(['the last viewer']);
  });

  it("swaps in an empty cache after a sign-in or a sign-out, never clearing the last viewer's under a reader", async () => {
    const { router, queryClient } = await routerAt('/subscriptions', { session: GUEST });
    const invalidate = vi.spyOn(router, 'invalidate');
    const clear = vi.spyOn(queryClient, 'clear');

    await settleSession(router);

    expect(router.options.context.queryClient.getQueryData(['videos', 'mine'])).toBeUndefined();
    expect(clear).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledOnce();
  });

  it('switches identity in place: its own cache, the URL under its prefix, one history entry', async () => {
    const listed = withSignedIn(NO_ACCOUNTS, {
      slot: 1,
      userId: 'u1',
      label: 'Two',
      avatarUrl: null,
    });
    // oxlint-disable-next-line unicorn/no-document-cookie -- the slot list a sign-in left in the browser.
    document.cookie = `vp.accounts=${encodeURIComponent(JSON.stringify({ ...listed, defaultSlot: 0 }))}; path=/`;
    const { router, queryClient } = await routerAt('/subscriptions?tab=new', {
      session: SIGNED_IN,
    });
    const entries = router.history.length;

    await switchIdentity(router, { slot: 1, channel: 'second' });

    expect(router.history.location.pathname).toBe('/u/1/c/second/subscriptions');
    expect(router.state.location.pathname).toBe('/subscriptions');
    expect(router.history.length).toBe(entries);
    expect(router.options.context.queryClient).not.toBe(queryClient);
    expect(router.options.context.queryClient.getQueryData(['videos', 'mine'])).toBeUndefined();
    expect(decodeURIComponent(document.cookie)).toContain('"defaultSlot":1');
  });

  it("never renders the last identity's response that lands after the switch", async () => {
    const named = (displayName: string) =>
      HttpResponse.json<Account>(account({ channel: { ...account().channel, displayName } }));
    const alice = heldReply(() => named('Alice'));
    let aliceAnswered = false;
    apiServer.use(
      mockEndpoint(getAccount, ({ request }) =>
        request.headers.get('x-account-slot') === '1'
          ? named('Bob')
          : alice.answer().finally(() => {
              aliceAnswered = true;
            })
      )
    );
    const router = createAppRouter(
      { routeTree, apiBaseUrl: 'http://localhost:3000', pending: () => null },
      {
        history: createMemoryHistory({ initialEntries: ['/who'] }),
        identity: createIdentityStore({ identity: { slot: 0 }, prefixed: true }),
      }
    );
    await router.load();
    render(<RouterProvider router={router} />, { container: document.body });
    await screen.findByText('Loading');

    await switchIdentity(router, { slot: 1 });
    await screen.findByText('Signed in as Bob');
    alice.release();
    await vi.waitFor(() => expect(aliceAnswered).toBe(true));

    expect(screen.queryByText('Signed in as Alice')).toBeNull();
    expect(screen.getByText('Signed in as Bob')).toBeInTheDocument();
  });
});

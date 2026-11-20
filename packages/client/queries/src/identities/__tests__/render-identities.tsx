import { ToastProvider } from '@kit/ui';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  notFound,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  type IdentitiesView,
  getAccount,
  getUnreadNotificationCount,
  listMyIdentities,
  listNotifications,
} from '@vp/api-contracts';
import {
  account,
  apiServer,
  channel,
  identities,
  mockEndpoint,
  sameOriginApiProxy,
} from '@vp/web-testing';
import { HttpResponse, delay } from 'msw';
import type { ReactNode } from 'react';
import { type Accounts, NO_ACCOUNTS, withExpired, withSignedIn } from '../../accounts';
import { ApiProvider } from '../../api-provider';
import { type AppRouterContext, createAppRouter } from '../../app-router';
import { createIdentityStore } from '../../identity-store';
import { type Session, ensureSession } from '../../session';
import { SessionProvider } from '../../session-provider';
import { useTabIdentity } from '../../use-tab-identity';
import type { AccountLink } from '../account-links';
import { AccountSwitcher } from '../account-switcher';
import { IdentitySwitcherDialog } from '../identity-switcher-dialog';
import { IdentitySwitcherProvider } from '../identity-switcher-provider';

export const MANAGE: AccountLink = { kind: 'route', label: 'Manage accounts', to: '/settings' };

/** One signed-in account of the browser under test: its slot, its name, its owned channels. */
export type TestAccount = {
  slot: number;
  name: string;
  /** Owned channels besides the primary, by handle. */
  channels?: string[];
  /** Teams it works on, by handle. */
  teams?: string[];
  expired?: boolean;
  unread?: number;
};

const userId = (slot: number) =>
  `0190c3a0-5e1d-7000-8000-0000000000${String(slot).padStart(2, '0')}`;
const handleOf = (name: string) => name.toLowerCase().replaceAll(/[^a-z0-9]/g, '');

function accountOf({ slot, name }: TestAccount) {
  const primary = channel({ id: userId(slot + 50), handle: handleOf(name), displayName: name });
  return account({
    user: { ...account().user, id: userId(slot) },
    channel: primary,
    channels: [primary],
  });
}

function identitiesOf(test: TestAccount): IdentitiesView {
  const card = (handle: string, index: number) => ({
    id: userId(60 + index),
    handle,
    displayName: handle.toUpperCase(),
    avatarUrl: null,
  });
  const { channel: primary } = accountOf(test);
  return identities({
    account: { id: userId(test.slot), email: 'a@example.com' },
    owned: [
      { ...primary, isPrimary: true },
      ...(test.channels ?? []).map((handle, index) => ({
        ...card(handle, index),
        isPrimary: false,
      })),
    ],
    member: (test.teams ?? []).map((handle, index) => ({
      ...card(handle, index + 10),
      role: 'editor' as const,
      ownerId: userId(40),
    })),
  });
}

/** The slot a call went as: the proxy's header, or the token a server function sent. */
function slotOf(request: Request): number {
  const header = request.headers.get('x-account-slot');
  if (header !== null) return Number(header);
  return Number(request.headers.get('authorization')?.replace('Bearer token-', ''));
}

export type IdentityApi = {
  /** Every `GET /v1/me/account` asked, by the slot it went as. */
  accountCalls: number[];
  /** Holds slot `slot`'s account answer until `release` is called. */
  hold: (slot: number) => () => void;
};

function answerAccounts(accounts: readonly TestAccount[]): IdentityApi {
  const accountCalls: number[] = [];
  const held = new Map<number, Promise<void>>();
  const bySlot = (request: Request) => accounts.find(({ slot }) => slot === slotOf(request));
  apiServer.use(
    sameOriginApiProxy,
    mockEndpoint(getAccount, async ({ request }) => {
      const slot = slotOf(request);
      accountCalls.push(slot);
      await held.get(slot);
      const test = bySlot(request);
      return test ? HttpResponse.json(accountOf(test)) : HttpResponse.json(account());
    }),
    mockEndpoint(listMyIdentities, ({ request }) => {
      const test = bySlot(request);
      return HttpResponse.json(test ? identitiesOf(test) : identities());
    }),
    mockEndpoint(getUnreadNotificationCount, ({ request }) =>
      HttpResponse.json({ unreadCount: bySlot(request)?.unread ?? 0 })
    ),
    mockEndpoint(listNotifications, () => HttpResponse.json({ items: [], nextCursor: null }))
  );
  return {
    accountCalls,
    hold: (slot) => {
      let release = () => undefined as void;
      held.set(
        slot,
        new Promise<void>((resolve) => {
          release = resolve;
        }).then(() => delay(0))
      );
      return () => release();
    },
  };
}

function signInBrowser(accounts: readonly TestAccount[], defaultSlot: number): void {
  const listed = accounts.reduce<Accounts>((kept, test) => {
    const signedIn = withSignedIn(kept, {
      slot: test.slot,
      userId: userId(test.slot),
      label: test.name,
      avatarUrl: null,
    });
    return test.expired ? withExpired(signedIn, test.slot) : signedIn;
  }, NO_ACCOUNTS);
  for (const test of accounts) {
    if (test.expired) continue;
    // oxlint-disable-next-line unicorn/no-document-cookie -- the browser arrives signed in.
    document.cookie = `vp.session.${test.slot}=token-${test.slot}; path=/`;
  }
  const value = encodeURIComponent(JSON.stringify({ ...listed, defaultSlot }));
  // oxlint-disable-next-line unicorn/no-document-cookie -- the slot list scripts may read.
  document.cookie = `vp.accounts=${value}; path=/`;
}

export type RenderIdentitiesOptions = {
  accounts: readonly TestAccount[];
  /** The slot the tab acts as. */
  slot?: number;
  url?: string;
  /** What the page under test renders beside the account menu. */
  page?: () => ReactNode;
};

/**
 * Renders a page of a router built as the apps build theirs (the switcher above the session, the
 * session keyed by the tab's identity, the account menu and the switcher's dialog), in a browser
 * signed in to `accounts`, and answers the API per slot. `/refused` 404s for every slot but 0.
 */
export async function renderIdentities({
  accounts,
  slot = 0,
  url = '/page',
  page = () => null,
}: RenderIdentitiesOptions) {
  signInBrowser(accounts, slot);
  const identityApi = answerAccounts(accounts);
  const rootRoute = createRootRouteWithContext<AppRouterContext>()({
    beforeLoad: async ({ context }) => ({ auth: await ensureSession(context) }),
    component: function Root() {
      const { api, toaster, auth } = rootRoute.useRouteContext() as AppRouterContext & {
        auth: Session;
      };
      const { identity, prefixed } = useTabIdentity();
      return (
        <ApiProvider api={api}>
          <ToastProvider toaster={toaster}>
            <IdentitySwitcherProvider fallback="/">
              <SessionProvider session={auth} identity={identity} prefixed={prefixed}>
                <header>
                  <AccountSwitcher links={[]} manage={MANAGE} />
                </header>
                <main>
                  <Outlet />
                </main>
                <IdentitySwitcherDialog links={[]} manage={MANAGE} />
              </SessionProvider>
            </IdentitySwitcherProvider>
          </ToastProvider>
        </ApiProvider>
      );
    },
  });
  const page404 = createRoute({
    getParentRoute: () => rootRoute,
    path: '/refused',
    loader: ({ context }) => {
      if (context.identity.read().identity.slot !== 0) throw notFound();
    },
    component: () => <h1>Refused page</h1>,
  });
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <h1>Home</h1> }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/page',
      component: () => (
        <>
          <h1>Page</h1>
          {page()}
        </>
      ),
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/login',
      component: () => <h1>Login</h1>,
    }),
    page404,
  ]);
  const history = createMemoryHistory({ initialEntries: [url] });
  const router = createAppRouter(
    { routeTree, apiBaseUrl: 'http://localhost:3000', pending: () => null },
    {
      history,
      identity: createIdentityStore({ identity: { slot }, prefixed: accounts.length > 1 }),
    }
  );
  await router.load();
  const user = userEvent.setup();
  render(<RouterProvider router={router} />);
  return { router, history, user, ...identityApi };
}

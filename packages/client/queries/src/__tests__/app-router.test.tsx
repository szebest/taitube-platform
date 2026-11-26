import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  Outlet,
} from '@tanstack/react-router';
import { type Account, getAccount } from '@vp/api-contracts';
import { account, mockEndpoint } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';
import { createActingChannelStore } from '../acting-channel';
import {
  type AppRouterContext,
  type AppRouterOptions,
  createAppRouter,
  useLayoutMaxWidth,
} from '../app-router';
import { createQueryClient } from '../create-query-client';
import { createIdentityStore } from '../identity-store';
import { createLocaleStore } from '../intl';
import { RouteError, RouteNotFound } from '../route-errors';
import { ensureSession } from '../session';
import { SPEC_MESSAGES } from './spec-messages';

const Pending = () => <p>Pending</p>;

const rootRoute = createRootRouteWithContext<AppRouterContext>()({
  component: () => (
    <main style={{ maxWidth: useLayoutMaxWidth() }}>
      <Outlet />
    </main>
  ),
});

const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/whoami',
  beforeLoad: async ({ context }) => ({ auth: await ensureSession(context) }),
  component: function WhoAmI() {
    const { auth } = sessionRoute.useRouteContext();
    return <p>{auth.status === 'signed-in' ? auth.account.channel.displayName : 'guest'}</p>;
  },
});
const routeTree = rootRoute.addChildren([
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/narrow',
    staticData: { layoutMaxWidth: '640px' },
    component: () => <p>Narrow</p>,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/wide', component: () => <p>Wide</p> }),
  createRoute({ getParentRoute: () => rootRoute, path: '/echo', component: () => <p>Echo</p> }),
  sessionRoute,
]);

const TWO_SLOTS = { cookie: 'vp.session.0=zero; vp.session.1=one' };

function getRouter(options: AppRouterOptions = {}) {
  return createAppRouter(
    {
      routeTree,
      messages: SPEC_MESSAGES,
      apiBaseUrl: 'http://localhost:3000',
      pending: Pending,
    },
    options
  );
}

describe('@vp/queries: app router', () => {
  it('builds a new query cache and client for every router, so no two requests share one', () => {
    const { context: first } = getRouter().options;
    const { context: second } = getRouter().options;

    expect(first.queryClient).not.toBe(second.queryClient);
    expect(first.api).not.toBe(second.api);
  });

  it('puts the query cache it is handed in context', () => {
    const queryClient = createQueryClient();

    expect(getRouter({ queryClient }).options.context.queryClient).toBe(queryClient);
  });

  it("stamps the request's CSP nonce on the scripts it renders", () => {
    expect(getRouter({ nonce: 'n0nce' }).options.ssr?.nonce).toBe('n0nce');
  });

  it('preloads on intent, waits before showing a pending page, then shows it long enough not to flash', () => {
    const { options } = getRouter();

    expect(options.defaultPreload).toBe('intent');
    expect(options.defaultPendingMs).toBeGreaterThan(0);
    expect(options.defaultPendingMinMs).toBeGreaterThan(0);
  });

  it.each([{ defaultPreload: false as const }, { defaultPreload: 'intent' as const }])(
    'preloads as the caller says: $defaultPreload',
    ({ defaultPreload }) => {
      expect(getRouter({ defaultPreload }).options.defaultPreload).toBe(defaultPreload);
    }
  );

  it.each([
    { motion: 'standard', hrefChanged: true, types: ['navigation'] },
    { motion: 'reduced', hrefChanged: true, types: false },
    { motion: 'standard', hrefChanged: false, types: false },
  ])(
    'runs a load through a view transition typed $types under $motion motion when the address changed: $hrefChanged',
    ({ motion, hrefChanged, types }) => {
      const router = getRouter();
      const { defaultViewTransition } = router.options;
      if (
        typeof defaultViewTransition !== 'object' ||
        typeof defaultViewTransition.types !== 'function'
      ) {
        throw new Error('the router has no view transition types');
      }
      const change = {
        toLocation: router.latestLocation,
        pathChanged: hrefChanged,
        hrefChanged,
        hashChanged: false,
      };
      vi.stubGlobal('document', { documentElement: { dataset: { motion } } });

      expect(defaultViewTransition.types(change)).toEqual(types);
    }
  );

  it("registers the app's pending, error and not-found pages for every route", () => {
    const { options } = getRouter();

    expect(options.defaultPendingComponent).toBe(Pending);
    expect(options.defaultErrorComponent).toBe(RouteError);
    expect(options.defaultNotFoundComponent).toBe(RouteNotFound);
  });

  it.each([
    { path: '/narrow', style: '<main style="max-width:640px">' },
    { path: '/wide', style: '<main>' },
  ])('hands the layout the width the route under $path asks for', async ({ path, style }) => {
    const { html } = await serverRender(getRouter, path);

    expect(html).toContain(style);
  });

  it.each([
    { label: 'a number', q: '1.10' },
    { label: 'a JSON literal', q: 'null' },
    { label: 'a JSON object', q: '{"a":1}' },
  ])('keeps $label in a search param as the text the URL carries, both ways', async ({ q }) => {
    const href = `/echo?${new URLSearchParams({ q })}`;
    const router = getRouter({ history: createMemoryHistory({ initialEntries: [href] }) });

    await router.load();

    expect(router.state.location.search).toEqual({ q });
    expect(router.buildLocation({ to: '/echo', search: { q } }).href).toBe(href);
  });

  it('dehydrates the instant it rendered at, which the hydration measures relative times from', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-30T12:00:00.000Z') });

    const { html } = await serverRender(getRouter, '/wide');
    vi.useRealTimers();

    expect(html).toContain('2026-10-30T12:00:00.000Z');
  });

  it('dehydrates the active locale into the page', async () => {
    const locales = createLocaleStore(SPEC_MESSAGES);
    await locales.activate('pl');

    const { html } = await serverRender(() => getRouter({ locales }), '/wide');

    expect(html).toContain('locale:"pl"');
  });

  it.each([
    { carried: 'pl', active: 'pl' },
    { carried: 'xx', active: 'en' },
  ])(
    'activates $active when the page carries $carried, before the browser hydrates',
    async ({ carried, active }) => {
      const browser = getRouter();

      await browser.options.hydrate?.({ renderedAt: '2026-10-30T12:00:00.000Z', locale: carried });

      expect(browser.options.context.locales.snapshot().locale).toBe(active);
    }
  );

  it('carries the acting channel into the page, so the browser names the one the server rendered for', async () => {
    const actingChannel = createActingChannelStore();
    actingChannel.select('chan-2');

    const { html } = await serverRender(() => getRouter({ actingChannel }), '/wide');
    const browser = getRouter();
    await browser.options.hydrate?.({ locale: 'en', actingChannel: 'chan-2' });

    expect(html).toContain('actingChannel:"chan-2"');
    expect(browser.options.context.actingChannel.read()).toBe('chan-2');
  });

  it('renders the not-found page for a path no route matches', async () => {
    const { status, html } = await serverRender(getRouter, '/nope');

    expect(status).toBe(404);
    expect(html).toContain('Page not found');
  });

  it.each([
    { path: '/u/1/echo', identity: '{\\"identity\\":{\\"slot\\":1},\\"prefixed\\":true}' },
    { path: '/u/1/c/second/echo', identity: '\\"channel\\":\\"second\\"' },
  ])(
    'matches $path without its prefix, and carries the identity into the page',
    async ({ path, identity }) => {
      const { status, html } = await serverRender(getRouter, path, { headers: TWO_SLOTS });

      expect(status).toBe(200);
      expect(html).toContain('<p>Echo</p>');
      expect(html).toContain(identity);
    }
  );

  it.each([
    { tab: '/u/1/whoami', name: 'Slot One', other: 'Slot Zero' },
    { tab: '/u/0/whoami', name: 'Slot Zero', other: 'Slot One' },
  ])(
    "renders $tab, one of two tabs in one browser, with its own slot's account and nothing of the other's",
    async ({ tab, name, other }) => {
      const named = (displayName: string) =>
        HttpResponse.json<Account>(account({ channel: { ...account().channel, displayName } }));
      const { html } = await serverRender(getRouter, tab, {
        headers: TWO_SLOTS,
        handlers: [
          mockEndpoint(getAccount, ({ request }) =>
            named(request.headers.get('authorization') === 'Bearer one' ? 'Slot One' : 'Slot Zero')
          ),
        ],
      });

      expect(html).toContain(`<p>${name}</p>`);
      expect(html).not.toContain(other);
    }
  );

  it('keeps links under the prefix once the browser holds two accounts, and a one-account browser free of it', () => {
    const prefixed = getRouter({
      identity: createIdentityStore({ identity: { slot: 2, channel: 'second' }, prefixed: true }),
    });
    const plain = getRouter({
      identity: createIdentityStore({ identity: { slot: 0 }, prefixed: false }),
    });

    expect(prefixed.buildLocation({ to: '/echo' }).publicHref).toBe('/u/2/c/second/echo');
    expect(prefixed.buildLocation({ to: '/login' }).publicHref).toBe('/login');
    expect(plain.buildLocation({ to: '/echo' }).publicHref).toBe('/echo');
  });

  it('takes the identity the server rendered for as the browser hydrates, with the cache it filled', async () => {
    const browser = getRouter();
    const { queryClient } = browser.options.context;

    await browser.options.hydrate?.({
      locale: 'en',
      identity: JSON.stringify({ identity: { slot: 3 }, prefixed: true }),
    });

    expect(browser.options.context.identity.read()).toEqual({
      identity: { slot: 3 },
      prefixed: true,
    });
    expect(browser.options.context.identity.queryClient()).toBe(queryClient);
  });
});

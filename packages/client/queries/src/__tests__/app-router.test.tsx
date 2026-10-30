import {
  Outlet,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
} from '@tanstack/react-router';
import { serverRender } from '@vp/web-testing/server';

import {
  type AppRouterContext,
  type AppRouterOptions,
  createAppRouter,
  useLayoutMaxWidth,
} from '../app-router';
import { createQueryClient } from '../create-query-client';
import { RouteError, RouteNotFound } from '../route-errors';

const Pending = () => <p>Pending</p>;

const rootRoute = createRootRouteWithContext<AppRouterContext>()({
  component: () => (
    <main style={{ maxWidth: useLayoutMaxWidth() }}>
      <Outlet />
    </main>
  ),
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
]);

function getRouter(options: AppRouterOptions = {}) {
  return createAppRouter(
    {
      routeTree,
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

  it.each([
    { motion: 'standard', types: ['navigation'] },
    { motion: 'reduced', types: false },
  ])(
    'runs a navigation through a view transition typed $types under $motion motion',
    ({ motion, types }) => {
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
        pathChanged: true,
        hrefChanged: true,
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

  it('renders the not-found page for a path no route matches', async () => {
    const { status, html } = await serverRender(getRouter, '/nope');

    expect(status).toBe(404);
    expect(html).toContain('Page not found');
  });
});

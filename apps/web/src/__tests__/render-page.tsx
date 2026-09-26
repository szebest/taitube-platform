import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import type { Account } from '@vp/api-contracts';
import { IntlProvider } from '@vp/intl-react';
import type { UserContext } from '@vp/permissions';
import type { HttpHandler } from 'msw';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { createQueryClient } from '../integrations/query/create-query-client';
import { accountApi } from '../modules/shared/api/account-api';
import { AuthProvider } from '../modules/shared/providers/auth-provider';
import { PermissionsProvider } from '../modules/shared/providers/permissions-provider';
import { SidebarProvider } from '../modules/shared/providers/sidebar-provider';
import { ThemeProvider } from '../modules/shared/providers/theme-provider';
import { type ApiStore, createApiStore, seed } from './api-store';
import { stubBrowser } from './browser';
import { apiServer } from './msw/api-server';

export type PageOptions = {
  store?: ApiStore;
  queryClient?: QueryClient;
  url?: string;
  route?: string;
  /** The pathless layout route `route` sits under, as the page's own route does. */
  layout?: string;
  viewer?: UserContext | null;
  /** How the API answers while the page renders; a call none of them answers fails the test. */
  handlers?: HttpHandler[];
};

/**
 * Renders inside the providers the root route mounts, in a fixed locale and zone, at `url` of a
 * router whose one route is `route`, over a store a spec can seed. A `viewer` overrides the
 * permissions the signed-in account would give.
 */
export async function renderPage(
  page: ReactElement,
  {
    store = createApiStore(),
    queryClient = createQueryClient(),
    url = '/',
    route = '/',
    layout,
    viewer,
    handlers = [],
  }: PageOptions = {}
): Promise<string> {
  apiServer.use(...handlers);
  const rootRoute = createRootRoute({
    component: () => (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <IntlProvider locale="en" timeZone="UTC">
            <AuthProvider>
              <PermissionsProvider userContext={viewer}>
                <Outlet />
              </PermissionsProvider>
            </AuthProvider>
          </IntlProvider>
        </QueryClientProvider>
      </Provider>
    ),
  });
  const parentRoute = layout
    ? createRoute({ getParentRoute: () => rootRoute, id: layout })
    : undefined;
  const pageRoute = createRoute({
    getParentRoute: () => parentRoute ?? rootRoute,
    path: route,
    component: () => page,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      parentRoute ? parentRoute.addChildren([pageRoute]) : pageRoute,
    ]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });

  await router.load();
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

/** Adds the sidebar and theme providers the layout reads. */
export function inChrome(page: ReactElement): ReactElement {
  return (
    <SidebarProvider>
      <ThemeProvider>{page}</ThemeProvider>
    </SidebarProvider>
  );
}

export async function signIn(store: ApiStore, signedIn: Account): Promise<void> {
  stubBrowser({ token: 'signed-in' });
  await seed(store, (target) => target.dispatch(accountApi.endpoints.account.initiate()), signedIn);
}

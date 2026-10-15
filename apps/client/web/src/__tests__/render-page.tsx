import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import { PermissionsProvider } from '@vp/permissions-react';
import { ApiProvider, AuthProvider, accountQueryOptions, createQueryClient } from '@vp/queries';
import { type ThemePreference, ThemeProvider, TooltipProvider } from '@vp/ui';
import { account, apiServer } from '@vp/web-testing';
import type { HttpHandler } from 'msw';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SidebarProvider } from '../modules/shared/providers/sidebar-provider';
import { api } from './api';
import { stubBrowser } from './browser';

export type PageOptions = {
  queryClient?: QueryClient;
  url?: string;
  route?: string;
  /** The pathless layout route `route` sits under, as the page's own route does. */
  layout?: string;
  viewer?: UserContext | null;
  handlers?: HttpHandler[];
};

/**
 * Renders inside the providers the root route mounts, in a fixed locale and zone, at `url` of a
 * router whose one route is `route`, over a query cache a spec can seed. A `viewer` overrides the
 * permissions the signed-in account would give.
 */
export async function renderPage(
  page: ReactElement,
  {
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
      <QueryClientProvider client={queryClient}>
        <IntlProvider locale="en" timeZone="UTC">
          <ApiProvider api={api}>
            <AuthProvider>
              {viewer === undefined ? (
                <Outlet />
              ) : (
                <PermissionsProvider userContext={viewer}>
                  <Outlet />
                </PermissionsProvider>
              )}
            </AuthProvider>
          </ApiProvider>
        </IntlProvider>
      </QueryClientProvider>
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

/** Adds the sidebar and theme providers the layout reads, the theme as the server read it. */
export function inChrome(page: ReactElement, theme: ThemePreference = 'dark'): ReactElement {
  return (
    <SidebarProvider>
      <ThemeProvider preference={theme}>
        <TooltipProvider>{page}</TooltipProvider>
      </ThemeProvider>
    </SidebarProvider>
  );
}

/** Stores a token and caches `signedIn` as the account it resolves to, so no request is made for it. */
export function signIn(
  signedIn: Account = account(),
  queryClient: QueryClient = createQueryClient()
): QueryClient {
  stubBrowser({ token: 'signed-in' });
  queryClient.setQueryData(accountQueryOptions(api).queryKey, signedIn);
  return queryClient;
}

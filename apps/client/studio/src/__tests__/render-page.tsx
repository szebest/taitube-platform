import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { IntlProvider } from '@vp/intl-react';
import {
  AUTH_TOKEN_LOCAL_STORAGE_KEY,
  ApiProvider,
  AuthProvider,
  accountQueryOptions,
  createQueryClient,
} from '@vp/queries';
import { ThemeProvider, TooltipProvider } from '@vp/ui';
import { account, apiServer, stubBrowser } from '@vp/web-testing';
import type { HttpHandler } from 'msw';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { api } from './api';

export type PageOptions = {
  queryClient?: QueryClient;
  url?: string;
  route?: string;
  /** The pathless layout route `route` sits under, as the page's own route does. */
  layout?: string;
  handlers?: HttpHandler[];
};

/**
 * Renders inside the providers the root route mounts, in a fixed locale and zone and the dark
 * theme, at `url` of a router whose one route is `route`, over a query cache a spec can seed.
 */
export async function renderPage(
  page: ReactElement,
  { queryClient = createQueryClient(), url = '/', route = '/', layout, handlers = [] }: PageOptions = {}
): Promise<string> {
  apiServer.use(...handlers);
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <IntlProvider locale="en" timeZone="UTC">
          <ApiProvider api={api}>
            <AuthProvider>
              <ThemeProvider preference="dark">
                <TooltipProvider>
                  <Outlet />
                </TooltipProvider>
              </ThemeProvider>
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

/** The browser of a creator with `token` stored, or a guest's without one. */
export function stubSession(token?: string): Map<string, string> {
  return stubBrowser(token ? { [AUTH_TOKEN_LOCAL_STORAGE_KEY]: token } : {});
}

/** Stores a token and caches `signedIn` as the account it resolves to, so no request is made for it. */
export function signIn(
  signedIn: ReturnType<typeof account> = account(),
  queryClient: QueryClient = createQueryClient()
): QueryClient {
  stubSession('signed-in');
  queryClient.setQueryData(accountQueryOptions(api).queryKey, signedIn);
  return queryClient;
}

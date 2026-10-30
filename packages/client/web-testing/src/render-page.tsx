import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import type { HttpHandler } from 'msw/http';
import type { ComponentType, PropsWithChildren, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { apiServer } from './api-server';

export type PageOptions = {
  /** The cache the page reads, seeded by the spec; a fresh one otherwise. */
  queryClient?: QueryClient;
  url?: string;
  /** The one route of the router the page renders at, `/` unless the page reads params. */
  route?: string;
  /** The pathless layout route `route` sits under, as the page's own route does. */
  layout?: string;
  handlers?: HttpHandler[];
};

/**
 * Renders `page` the way the server does, inside the app's `Providers` (what its root route mounts)
 * over the query cache, at `url` of a router whose one route is `route`.
 */
export async function renderPage(
  page: ReactElement,
  Providers: ComponentType<PropsWithChildren>,
  {
    queryClient = new QueryClient(),
    url = '/',
    route = '/',
    layout,
    handlers = [],
  }: PageOptions = {}
): Promise<string> {
  apiServer.use(...handlers);
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <Providers>
          <Outlet />
        </Providers>
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

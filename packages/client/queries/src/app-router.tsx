import type { QueryClient } from '@tanstack/react-query';
import {
  type AnyRoute,
  type ErrorRouteComponent,
  type NotFoundRouteComponent,
  type RouteComponent,
  Router,
  type RouterHistory,
  useMatches,
} from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import type { ApiClient } from '@vp/api-client';
import { requestNonce } from '@vp/security-headers';
import { type Toaster, createToaster } from '@vp/ui';

import { createAppApiClient } from './api-client';
import { createQueryClient } from './create-query-client';
import { endSession } from './session-changes';

/** What every route reads from context; the root route's `beforeLoad` adds `auth` (`ensureSession`). */
export type AppRouterContext = {
  api: ApiClient;
  queryClient: QueryClient;
  toaster: Toaster;
};

/** What a spec or a request hands the router in place of the defaults it would build. */
export type AppRouterOptions = Partial<AppRouterContext> & {
  history?: RouterHistory;
  nonce?: string;
};

export type AppRoutes<TRouteTree extends AnyRoute> = {
  routeTree: TRouteTree;
  /** Where the app's API client calls, from the app's own `src/config`. */
  apiBaseUrl: string;
  pending: RouteComponent;
  error: ErrorRouteComponent;
  notFound: NotFoundRouteComponent;
};

const PENDING_DELAY_MS = 1000;
const PENDING_MIN_MS = 500;

/**
 * A client app's router: one API client, query cache and toaster per router in context
 * (so no two requests share one), the request's CSP nonce on every script, preloading on intent, a
 * pending page that waits before it shows and then stays long enough not to flash, and the query
 * cache dehydrated into the page.
 */
export function createAppRouter<TRouteTree extends AnyRoute>(
  { routeTree, apiBaseUrl, pending, error, notFound }: AppRoutes<TRouteTree>,
  {
    history,
    api,
    queryClient = createQueryClient(),
    toaster = createToaster(),
    nonce = requestNonce(),
  }: AppRouterOptions = {}
): Router<TRouteTree> {
  const sessionApi = () =>
    createAppApiClient({ apiBaseUrl, onUnauthorized: () => endSession(router) });
  // Named as `Router`, not `createRouter`'s `RouterCore`, so the emitted declaration imports a
  // package the apps resolve: `@tanstack/router-core` is react-router's own dependency, not theirs.
  const router: Router<TRouteTree> = new Router({
    routeTree,
    history,
    ssr: { nonce },
    context: { api: api ?? sessionApi(), queryClient, toaster } satisfies AppRouterContext,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultPendingMs: PENDING_DELAY_MS,
    defaultPendingMinMs: PENDING_MIN_MS,
    defaultPendingComponent: pending,
    defaultErrorComponent: error,
    defaultNotFoundComponent: notFound,
    scrollRestoration: true,
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

/** The width the deepest matched route asks of the layout, from its `staticData.layoutMaxWidth`. */
export function useLayoutMaxWidth(): string | undefined {
  return useMatches({
    select: (matches) => matches.findLast((match) => match.staticData.layoutMaxWidth),
  })?.staticData.layoutMaxWidth;
}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    layoutMaxWidth?: string;
  }
}

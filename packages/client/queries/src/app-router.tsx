import type { QueryClient } from '@tanstack/react-query';
import {
  type AnyRoute,
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
import { AppWords } from './app-words';
import { createQueryClient } from './create-query-client';
import { RouteError, RouteNotFound } from './route-errors';
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
  /** `false` switches intent preloading off, for a viewer who saves data. */
  defaultPreload?: 'intent' | false;
};

export type AppRoutes<TRouteTree extends AnyRoute> = {
  routeTree: TRouteTree;
  /** Where the app's API client calls, from the app's own `src/config`. */
  apiBaseUrl: string;
  pending: RouteComponent;
};

function parseSearch(searchStr: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchStr));
}

function stringifySearch(search: Record<string, unknown>): string {
  const present = Object.entries(search).filter(([, value]) => value !== undefined);
  const searchStr = new URLSearchParams(present.map(([key, value]) => [key, String(value)]));
  return searchStr.size > 0 ? `?${searchStr}` : '';
}

/** Every navigation cross-fades through a view transition; under reduced motion the page swaps at once. */
const viewTransition = {
  types: () => (document.documentElement.dataset.motion === 'reduced' ? false : ['navigation']),
};

const PENDING_DELAY_MS = 1000;
const PENDING_MIN_MS = 500;

/**
 * A client app's router: one API client, query cache and toaster per router in context
 * (so no two requests share one), the request's CSP nonce on every script, preloading on intent, a
 * pending page that waits before it shows and then stays long enough not to flash, and the query
 * cache and the server's render instant dehydrated into the page. Search params stay the text the
 * URL carries (no JSON either way), so `?q=1.10` is `'1.10'` and each route's schema coerces what
 * it needs.
 */
export function createAppRouter<TRouteTree extends AnyRoute>(
  { routeTree, apiBaseUrl, pending }: AppRoutes<TRouteTree>,
  {
    history,
    api,
    queryClient = createQueryClient(),
    toaster = createToaster(),
    nonce = requestNonce(),
    defaultPreload = 'intent',
  }: AppRouterOptions = {}
): Router<TRouteTree> {
  let renderedAt = new Date().toISOString();
  const sessionApi = () =>
    createAppApiClient({ apiBaseUrl, onUnauthorized: () => endSession(router) });
  // Named as `Router`, not `createRouter`'s `RouterCore`, so the emitted declaration imports a
  // package the apps resolve: `@tanstack/router-core` is react-router's own dependency, not theirs.
  const router: Router<TRouteTree> = new Router({
    routeTree,
    history,
    ssr: { nonce },
    context: { api: api ?? sessionApi(), queryClient, toaster } satisfies AppRouterContext,
    defaultPreload,
    defaultPreloadStaleTime: 0,
    defaultViewTransition: viewTransition,
    defaultPendingMs: PENDING_DELAY_MS,
    defaultPendingMinMs: PENDING_MIN_MS,
    defaultPendingComponent: pending,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
    scrollRestoration: true,
    Wrap: ({ children }) => <AppWords renderedAt={renderedAt}>{children}</AppWords>,
    dehydrate: (): Record<string, string> => ({ renderedAt }),
    hydrate: (dehydrated) => {
      renderedAt = dehydrated['renderedAt'] ?? renderedAt;
    },
    parseSearch,
    stringifySearch,
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

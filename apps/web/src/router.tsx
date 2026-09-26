import type { QueryClient } from '@tanstack/react-query';
import { type RouterHistory, createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';

import { RouteError, RouteNotFound, RoutePending } from './components/route-fallbacks';
import { type Session, guestSession } from './integrations/auth/session';
import { createQueryClient } from './integrations/query/create-query-client';
import { routeTree } from './routeTree.gen';

export type RouterContext = {
  queryClient: QueryClient;
  auth: Session;
};

const PENDING_DELAY_MS = 1000;
const PENDING_MIN_MS = 500;

export type RouterOptions = Partial<RouterContext> & {
  history?: RouterHistory;
  nonce?: string;
};

export function getRouter({
  history,
  queryClient = createQueryClient(),
  auth = guestSession(),
  nonce,
}: RouterOptions = {}) {
  const router = createRouter({
    routeTree,
    history,
    ssr: { nonce },
    context: { queryClient, auth } satisfies RouterContext,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultPendingMs: PENDING_DELAY_MS,
    defaultPendingMinMs: PENDING_MIN_MS,
    defaultPendingComponent: RoutePending,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
    scrollRestoration: true,
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }

  interface StaticDataRouteOption {
    layoutMaxWidth?: string;
  }
}

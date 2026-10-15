import type { QueryClient } from '@tanstack/react-query';
import { type RouterHistory, createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import type { ApiClient } from '@vp/api-client';
import { type Session, createAppApiClient, createQueryClient, guestSession } from '@vp/queries';
import { requestNonce } from '@vp/security-headers';
import { type Toaster, createToaster } from '@vp/ui';

import { RouteError, RouteNotFound, RoutePending } from './components/route-fallbacks';
import { API_BASE_URL } from './config';
import { routeTree } from './routeTree.gen';

export type RouterContext = {
  api: ApiClient;
  queryClient: QueryClient;
  auth: Session;
  toaster: Toaster;
};

const PENDING_DELAY_MS = 1000;
const PENDING_MIN_MS = 500;

type RouterOptions = Partial<RouterContext> & {
  history?: RouterHistory;
  nonce?: string;
};

export function getRouter({
  history,
  api = createAppApiClient(API_BASE_URL),
  queryClient = createQueryClient(),
  auth = guestSession(),
  toaster = createToaster(),
  nonce = requestNonce(),
}: RouterOptions = {}) {
  const router = createRouter({
    routeTree,
    history,
    ssr: { nonce },
    context: { api, queryClient, auth, toaster } satisfies RouterContext,
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

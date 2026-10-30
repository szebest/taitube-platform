import { type AppRouterOptions, createAppRouter } from '@vp/queries';

import {
  RouteError,
  RouteNotFound,
  RoutePending,
} from './features/errors/components/route-fallbacks';
import { API_BASE_URL } from './config';
import { routeTree } from './routeTree.gen';

export function getRouter(options: AppRouterOptions = {}) {
  return createAppRouter(
    {
      routeTree,
      apiBaseUrl: API_BASE_URL,
      pending: RoutePending,
      error: RouteError,
      notFound: RouteNotFound,
    },
    options
  );
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

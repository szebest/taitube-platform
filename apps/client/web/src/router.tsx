import { type AppRouterOptions, createAppRouter } from '@vp/queries';
import { API_BASE_URL } from './config';
import { RoutePending } from './features/errors/components/route-fallbacks';
import { routeTree } from './routeTree.gen';

export function getRouter(options: AppRouterOptions = {}) {
  return createAppRouter(
    {
      routeTree,
      apiBaseUrl: API_BASE_URL,
      pending: RoutePending,
    },
    options
  );
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

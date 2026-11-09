import { type AppRouterOptions, createAppRouter } from '@vp/queries';
import { RoutePending } from './components/states/route-fallbacks/route-fallbacks';
import { API_BASE_URL } from './lib/config';
import { routeTree } from './routeTree.gen';

export function getRouter(options: AppRouterOptions = {}) {
  return createAppRouter(
    {
      routeTree,
      apiBaseUrl: API_BASE_URL,
      pending: RoutePending,
      actsOnChannels: true,
    },
    options
  );
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

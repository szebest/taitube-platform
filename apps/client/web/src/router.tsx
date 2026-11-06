import { type AppRouterOptions, createAppRouter } from '@vp/queries';
import { shouldPrefetch } from '#app/features/pwa';
import { RoutePending } from './components/states/route-fallbacks/route-fallbacks';
import { API_BASE_URL } from './lib/config';
import { routeTree } from './routeTree.gen';

export function getRouter(options: AppRouterOptions = {}) {
  return createAppRouter(
    {
      routeTree,
      apiBaseUrl: API_BASE_URL,
      pending: RoutePending,
    },
    { defaultPreload: shouldPrefetch() ? 'intent' : false, ...options }
  );
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }

  interface HistoryState {
    autoplay?: boolean;
  }
}

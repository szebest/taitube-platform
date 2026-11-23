import { type AppRouterOptions, createAppRouter, RoutePending } from '@vp/queries';
import { shouldPrefetch } from '#app/integrations/network/should-prefetch';
import { API_BASE_URL } from '#app/lib/config';
import { WEB_MESSAGES, type WebCatalogue } from '#app/lib/messages';
import { routeTree } from '#app/routeTree.gen';

export function getRouter(options: AppRouterOptions<WebCatalogue> = {}) {
  return createAppRouter(
    {
      routeTree,
      messages: WEB_MESSAGES,
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

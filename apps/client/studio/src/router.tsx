import { type AppRouterOptions, createAppRouter, RoutePending } from '@vp/queries';
import { STUDIO_MESSAGES, type StudioCatalogue } from '#app/lib/messages';
import { API_BASE_URL } from './lib/config';
import { routeTree } from './routeTree.gen';

export function getRouter(options: AppRouterOptions<StudioCatalogue> = {}) {
  return createAppRouter(
    {
      routeTree,
      messages: STUDIO_MESSAGES,
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

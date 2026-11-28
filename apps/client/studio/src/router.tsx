import { type AppRouterOptions, createAppRouter, RoutePending } from '@vp/queries';
import { studioComposition } from '#app/composition/registry';
import type { StudioCatalogue } from '#app/lib/messages';
import { routeTree } from './routeTree.gen';

export function getRouter(options: AppRouterOptions<StudioCatalogue> = {}) {
  return createAppRouter(
    {
      routeTree,
      messages: studioComposition.messages,
      apiBaseUrl: studioComposition.apiBaseUrl,
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

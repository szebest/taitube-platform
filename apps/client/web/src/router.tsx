import { type AppRouterOptions, createAppRouter, RoutePending } from '@vp/queries';
import { webComposition } from '#app/composition/registry';
import { shouldPrefetch } from '#app/integrations/network/should-prefetch';
import { viewerSessionKey } from '#app/integrations/viewer-session/viewer-session-key';
import type { WebCatalogue } from '#app/lib/messages';
import { routeTree } from '#app/routeTree.gen';

export function getRouter(options: AppRouterOptions<WebCatalogue> = {}) {
  return createAppRouter(
    {
      routeTree,
      messages: webComposition.messages,
      apiBaseUrl: webComposition.apiBaseUrl,
      pending: RoutePending,
      getViewerSession: viewerSessionKey,
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

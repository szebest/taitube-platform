/// <reference lib="webworker" />

import {
  cleanupOutdatedCaches,
  matchPrecache,
  type PrecacheEntry,
  precacheAndRoute,
} from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { registerBackgroundSync } from './integrations/service-worker/background-sync';
import { deleteStaleCaches } from './integrations/service-worker/delete-stale-caches';
import { offlineFallback } from './integrations/service-worker/offline-page';
import { isPageNavigation } from './integrations/service-worker/route-matchers';
import { registerRuntimeCaching } from './integrations/service-worker/runtime-caching';
import {
  registerSavedVideoRoutes,
  savedVideoFallback,
} from './integrations/service-worker/saved-videos';
import { SYNC_CHANNEL } from './integrations/service-worker/sync-messages';

declare global {
  interface ServiceWorkerGlobalScope {
    __WB_MANIFEST: (string | PrecacheEntry)[];
  }
}

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRuntimeCaching(self.location.origin, self.caches);
registerSavedVideoRoutes(self.location.origin);
registerBackgroundSync(self.location.origin, new BroadcastChannel(SYNC_CHANNEL));
registerRoute(({ url, request }) => isPageNavigation(url, request.mode), new NetworkOnly());
setCatchHandler(savedVideoFallback(self.caches, offlineFallback(matchPrecache)));

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([deleteStaleCaches(self.caches), self.clients.claim()]));
});

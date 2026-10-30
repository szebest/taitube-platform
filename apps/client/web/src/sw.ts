/// <reference lib="webworker" />

import {
  cleanupOutdatedCaches,
  matchPrecache,
  type PrecacheEntry,
  precacheAndRoute,
} from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { deleteStaleCaches } from './sw/delete-stale-caches';
import { offlineFallback } from './sw/offline-page';
import { isPageNavigation } from './sw/route-matchers';
import { registerRuntimeCaching } from './sw/runtime-caching';

declare global {
  interface ServiceWorkerGlobalScope {
    __WB_MANIFEST: (string | PrecacheEntry)[];
  }
}

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRuntimeCaching(self.location.origin);
registerRoute(({ url, request }) => isPageNavigation(url, request.mode), new NetworkOnly());
setCatchHandler(offlineFallback(matchPrecache));

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([deleteStaleCaches(self.caches), self.clients.claim()]));
});

import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CACHE_NAMES } from './cache-names';
import { publicResponsesOnly } from './public-response-plugin';
import { isPlaylist, isPublicApi, isStaticAsset, isVideoArt } from './route-matchers';

const ART_MAX_ENTRIES = 100;
const ART_MAX_AGE_S = 30 * 24 * 60 * 60;
const PLAYLIST_MAX_ENTRIES = 50;
const PLAYLIST_TIMEOUT_S = 3;
const API_TIMEOUT_S = 3;
const CORS_OR_OPAQUE = [0, 200];

/** Registers the runtime routes; first match wins, and the precache routes were registered before. */
export function registerRuntimeCaching(origin: string): void {
  registerRoute(
    ({ url, request }) => isStaticAsset(url, request.destination, origin),
    new StaleWhileRevalidate({
      cacheName: CACHE_NAMES.assets,
      plugins: [new CacheableResponsePlugin({ statuses: [200] })],
    })
  );

  registerRoute(
    ({ url }) => isVideoArt(url),
    new StaleWhileRevalidate({
      cacheName: CACHE_NAMES.media,
      plugins: [
        new CacheableResponsePlugin({ statuses: CORS_OR_OPAQUE }),
        new ExpirationPlugin({
          maxEntries: ART_MAX_ENTRIES,
          maxAgeSeconds: ART_MAX_AGE_S,
          purgeOnQuotaError: true,
        }),
      ],
    })
  );

  registerRoute(
    ({ url }) => isPlaylist(url),
    new NetworkFirst({
      cacheName: CACHE_NAMES.playlists,
      networkTimeoutSeconds: PLAYLIST_TIMEOUT_S,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({
          maxEntries: PLAYLIST_MAX_ENTRIES,
          maxAgeSeconds: ART_MAX_AGE_S,
          purgeOnQuotaError: true,
        }),
      ],
    })
  );

  registerRoute(
    ({ url }) => isPublicApi(url, origin),
    new NetworkFirst({
      cacheName: CACHE_NAMES.api,
      networkTimeoutSeconds: API_TIMEOUT_S,
      plugins: [{ cacheWillUpdate: publicResponsesOnly }],
    })
  );
}

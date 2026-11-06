import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { CACHE_NAMES } from './cache-names';
import { isSegment, isVideoDetail } from './route-matchers';

type FailedRequest = { request: Request; url: URL };
type Fallback = (failed: FailedRequest) => Promise<Response>;

/**
 * Routes the two kinds of call a saved video needs that no runtime cache covers, so their failure
 * reaches the catch handler: the video's detail and its media segments.
 */
export function registerSavedVideoRoutes(origin: string): void {
  registerRoute(({ url }) => isVideoDetail(url, origin) || isSegment(url), new NetworkOnly());
}

/**
 * Answers a request that failed from the saved cache when a saved video holds it, else from
 * `fallback`. The saved cache is not a runtime cache: nothing evicts from it but the viewer.
 */
export function savedVideoFallback(
  storage: Pick<CacheStorage, 'match'>,
  fallback: Fallback
): Fallback {
  return async (failed) =>
    (await storage.match(failed.request, { cacheName: CACHE_NAMES.saved })) ?? fallback(failed);
}

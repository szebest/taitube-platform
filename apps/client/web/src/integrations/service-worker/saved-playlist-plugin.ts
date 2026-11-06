import { CACHE_NAMES } from './cache-names';

/**
 * A playlist the network could not answer comes from the saved cache before the runtime cache:
 * the runtime cache holds the full ladder from earlier online viewing, the saved cache holds only
 * the renditions that were saved, and playback has to stay inside those.
 */
export function savedPlaylistsFirst(storage: Pick<CacheStorage, 'match'>) {
  return {
    cachedResponseWillBeUsed: async ({
      request,
      cachedResponse,
    }: {
      request: Request;
      cachedResponse?: Response;
    }): Promise<Response | undefined> =>
      (await storage.match(request, { cacheName: CACHE_NAMES.saved })) ?? cachedResponse,
  };
}

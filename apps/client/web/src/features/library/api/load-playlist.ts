import { fromPromise, isOk } from '@kit/result';
import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { ensureFound, failureCode } from '@vp/queries';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';

/** What `/playlist` may show: the playlist, now in the cache, or a dead share link. */
type PlaylistLoad = { readonly kind: 'open' } | { readonly kind: 'expired' };

/**
 * The playlist, read with the share link's token when the URL carries one. A 404 is the not-found
 * page as for any playlist, and every other failure the route's error page.
 */
export async function loadPlaylist(
  queryClient: QueryClient,
  api: ApiClient,
  playlistId: string,
  shareToken: string | undefined
): Promise<PlaylistLoad> {
  const loaded = await fromPromise(
    () => ensureFound(queryClient, playlistQueryOptions(api, playlistId, shareToken)),
    (cause) => cause
  );
  if (isOk(loaded)) {
    return { kind: 'open' };
  }
  if (failureCode(loaded.error) === ErrorCodes.SHARE_LINK_EXPIRED) {
    return { kind: 'expired' };
  }
  throw loaded.error;
}

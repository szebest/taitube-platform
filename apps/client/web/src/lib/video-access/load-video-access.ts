import { fromPromise, isOk } from '@kit/result';
import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { Video } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { ensureFound, failureCode, videoQueryOptions } from '@vp/queries';

/** What a page that plays one video may show: the video, its password gate, or a dead share link. */
export type VideoAccess =
  | { readonly kind: 'open'; readonly video: Video }
  | { readonly kind: 'password' }
  | { readonly kind: 'expired' };

/**
 * The video, read with the share link's token when the URL carries one, or why it stays shut. A
 * 404 is the not-found page as for any video, and every other failure the route's error page.
 */
export async function loadVideoAccess(
  queryClient: QueryClient,
  api: ApiClient,
  videoId: string,
  shareToken: string | undefined
): Promise<VideoAccess> {
  const loaded = await fromPromise(
    () => ensureFound(queryClient, videoQueryOptions(api, videoId, shareToken)),
    (cause) => cause
  );
  if (isOk(loaded)) return { kind: 'open', video: loaded.value };

  switch (failureCode(loaded.error)) {
    case ErrorCodes.VIDEO_PASSWORD_REQUIRED:
      return { kind: 'password' };
    case ErrorCodes.SHARE_LINK_EXPIRED:
      return { kind: 'expired' };
    default:
      throw loaded.error;
  }
}

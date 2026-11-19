import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { KEYSET_PAGE_SIZE, keysetPaging } from './keyset-paging';
import { videoKeys } from './video-queries';

export const videoToolKeys = {
  corrections: (videoId: string) => [...videoKeys.detail(videoId), 'corrections'] as const,
  revisions: (videoId: string) => [...videoKeys.detail(videoId), 'revisions'] as const,
};

/** Public: the cards of a video, in playback order, for the player and the list under the description. */
export function correctionsQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: videoToolKeys.corrections(videoId),
    queryFn: () => api.videoTools.listVideoCorrections({ params: { id: videoId } }),
  });
}

/** The metadata history of a video the caller may edit, newest first. */
export function revisionsQueryOptions(api: ApiClient, videoId: string) {
  return infiniteQueryOptions({
    queryKey: videoToolKeys.revisions(videoId),
    queryFn: ({ pageParam }) =>
      api.videoTools.listVideoRevisions({
        params: { id: videoId },
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

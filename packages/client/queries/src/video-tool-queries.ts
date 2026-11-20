import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { KEYSET_PAGE_SIZE, keysetPaging } from './keyset-paging';
import { videoKeys } from './video-queries';

export const videoToolKeys = {
  corrections: (videoId: string) => [...videoKeys.detail(videoId), 'corrections'] as const,
  revisions: (videoId: string) => [...videoKeys.detail(videoId), 'revisions'] as const,
  shareLinks: (videoId: string) => [...videoKeys.detail(videoId), 'share-links'] as const,
  experiments: (videoId: string) => [...videoKeys.detail(videoId), 'experiments'] as const,
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

/** The share links of a video the caller may edit, newest first, each with its numbers so far. */
export function shareLinksQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: videoToolKeys.shareLinks(videoId),
    queryFn: () => api.videoAccess.listVideoShareLinks({ params: { id: videoId } }),
  });
}

/** The title and thumbnail tests of a video the caller may edit, newest first, with their results. */
export function experimentsQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: videoToolKeys.experiments(videoId),
    queryFn: () => api.videoExperiments.listVideoExperiments({ params: { id: videoId } }),
  });
}

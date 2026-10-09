import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { apiClient } from '#app/integrations/api/api-client';
import { KEYSET_PAGE_SIZE, keysetPaging } from '#app/integrations/query/keyset-paging';

export const videoKeys = {
  all: ['videos'] as const,
  detail: (videoId: string) => [...videoKeys.all, 'detail', videoId] as const,
  mine: () => [...videoKeys.all, 'mine'] as const,
};

export function videoQueryOptions(videoId: string) {
  return queryOptions({
    queryKey: videoKeys.detail(videoId),
    queryFn: () => apiClient.videos.getVideo({ params: { id: videoId } }),
  });
}

export function myVideosQueryOptions() {
  return infiniteQueryOptions({
    queryKey: videoKeys.mine(),
    queryFn: ({ pageParam }) =>
      apiClient.videos.listVideos({ query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam } }),
    ...keysetPaging,
  });
}

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

import { KEYSET_PAGE_SIZE, keysetPaging } from './keyset-paging';

export const videoKeys = {
  all: ['videos'] as const,
  detail: (videoId: string) => [...videoKeys.all, 'detail', videoId] as const,
  mine: () => [...videoKeys.all, 'mine'] as const,
};

export function videoQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: videoKeys.detail(videoId),
    queryFn: () => api.videos.getVideo({ params: { id: videoId } }),
  });
}

export function myVideosQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: videoKeys.mine(),
    queryFn: ({ pageParam }) =>
      api.videos.listVideos({ query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam } }),
    ...keysetPaging,
  });
}

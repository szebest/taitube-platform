import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

export const relatedKeys = {
  all: ['related'] as const,
  of: (videoId: string) => [...relatedKeys.all, videoId] as const,
};

export function relatedQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: relatedKeys.of(videoId),
    queryFn: () => api.recommendations.getRelatedVideos({ params: { id: videoId } }),
  });
}

import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

export function relatedQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: ['related', videoId],
    queryFn: () => api.recommendations.getRelatedVideos({ params: { id: videoId } }),
  });
}

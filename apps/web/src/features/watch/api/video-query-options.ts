import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '#app/base-api';

export function videoQueryOptions(videoId: string) {
  return queryOptions({
    queryKey: ['videos', videoId],
    queryFn: () => apiClient.videos.getVideo({ params: { id: videoId } }),
  });
}

import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

const videoScreeningKeys = {
  all: ['creator', 'screening'] as const,
  detail: (videoId: string) => [...videoScreeningKeys.all, videoId] as const,
};

/** Why one of the creator's videos is on hold or was rejected by screening, in plain terms, and whether it can be appealed. */
export function videoScreeningQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: videoScreeningKeys.detail(videoId),
    queryFn: ({ signal }) => api.screening.getVideoScreening({ params: { id: videoId }, signal }),
  });
}

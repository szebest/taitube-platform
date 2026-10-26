import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

export function homeQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: ['home'],
    queryFn: () => api.recommendations.getHome(),
  });
}

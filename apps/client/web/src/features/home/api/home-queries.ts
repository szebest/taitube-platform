import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

export const homeKeys = { all: ['home'] as const };

export function homeQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: homeKeys.all,
    queryFn: () => api.recommendations.getHome(),
  });
}

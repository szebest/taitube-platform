import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

export const preferencesKeys = {
  all: ['preferences'] as const,
};

export function preferencesQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: preferencesKeys.all,
    queryFn: () => api.preferences.getPreferences(),
  });
}

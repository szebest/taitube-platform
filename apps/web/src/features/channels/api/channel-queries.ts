import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '#app/integrations/api/api-client';

export const channelKeys = {
  all: ['channels'] as const,
  detail: (channelId: string) => [...channelKeys.all, 'detail', channelId] as const,
};

export function channelQueryOptions(channelId: string) {
  return queryOptions({
    queryKey: channelKeys.detail(channelId),
    queryFn: () => apiClient.channels.getChannel({ params: { idOrHandle: channelId } }),
  });
}

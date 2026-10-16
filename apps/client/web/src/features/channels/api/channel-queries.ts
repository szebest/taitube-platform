import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

const channelKeys = {
  all: ['channels'] as const,
  detail: (channelId: string) => [...channelKeys.all, 'detail', channelId] as const,
};

export function channelQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: channelKeys.detail(channelId),
    queryFn: () => api.channels.getChannel({ params: { idOrHandle: channelId } }),
  });
}

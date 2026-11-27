import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

export const actingChannelKeys = {
  all: ['channel', 'acting'] as const,
  channel: (channelId: string) => [...actingChannelKeys.all, channelId] as const,
};

/** The channel the studio acts on, with what only its team sees; the key carries the channel so switching never shows another's. */
export function actingChannelQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: actingChannelKeys.channel(channelId),
    queryFn: () => api.me.getMyChannel(),
  });
}

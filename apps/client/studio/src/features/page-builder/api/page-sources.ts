import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { pageKeys } from './page-queries';

export function pagePlaylistsQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: [...pageKeys.channel(channelId), 'playlists'] as const,
    queryFn: async () =>
      (await api.playlists.listMyPlaylists({ query: {} })).items.filter(
        ({ visibility }) => visibility === 'public'
      ),
  });
}

export function pageChannelQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: [...pageKeys.channel(channelId), 'channel'] as const,
    queryFn: () => api.me.getMyChannel(),
  });
}

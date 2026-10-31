import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

const CHANNEL_VIDEOS_LIMIT = 30;

const channelKeys = {
  all: ['channels'] as const,
  detail: (channelId: string) => [...channelKeys.all, 'detail', channelId] as const,
  videos: (channelId: string) => [...channelKeys.all, 'videos', channelId] as const,
  startHere: (channelId: string) => [...channelKeys.all, 'start-here', channelId] as const,
};

export function channelQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: channelKeys.detail(channelId),
    queryFn: () => api.channels.getChannel({ params: { idOrHandle: channelId } }),
  });
}

/** The channel's newest public videos, the first page. */
export function channelVideosQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: channelKeys.videos(channelId),
    queryFn: () =>
      api.channelVideos.listChannelVideos({
        params: { idOrHandle: channelId },
        query: { limit: CHANNEL_VIDEOS_LIMIT },
      }),
  });
}

/** The channel's Start here shelf: its pins, or its most-watched uploads, with which of the two it is. */
export function channelStartHereQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: channelKeys.startHere(channelId),
    queryFn: () => api.channelFeatured.getChannelFeatured({ params: { idOrHandle: channelId } }),
  });
}

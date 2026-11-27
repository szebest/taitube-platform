import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

const channelKeys = {
  all: ['channels'] as const,
  detail: (channelId: string) => [...channelKeys.all, 'detail', channelId] as const,
  startHere: (channelId: string) => [...channelKeys.all, 'start-here', channelId] as const,
  spotlight: (channelId: string) => [...channelKeys.all, 'spotlight', channelId] as const,
};

/** Every spotlight of the channel, whatever the locale or viewer, for one invalidation. */
export const channelSpotlightScope = channelKeys.spotlight;

export function channelQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: channelKeys.detail(channelId),
    queryFn: () => api.channels.getChannel({ params: { idOrHandle: channelId } }),
  });
}

/** The channel's Start here shelf: its pins, or its most-watched uploads, with which of the two it is. */
export function channelStartHereQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: channelKeys.startHere(channelId),
    queryFn: () => api.channelFeatured.getChannelFeatured({ params: { idOrHandle: channelId } }),
  });
}

/** The trailer or returning-subscriber video, kept apart from the channel so the page stays shared: keyed by locale and viewer. */
export function channelSpotlightQueryOptions(
  api: ApiClient,
  channelId: string,
  locale: string,
  viewerId: string | null
) {
  return queryOptions({
    queryKey: [...channelKeys.spotlight(channelId), locale, viewerId ?? 'guest'] as const,
    queryFn: () =>
      api.channelIdentity.getChannelSpotlight({
        params: { idOrHandle: channelId },
        query: { locale },
      }),
  });
}

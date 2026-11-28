import { KEYSET_PAGE_SIZE, keysetPaging } from '@kit/query';
import { infiniteQueryOptions, type QueryClient, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

type ChannelPagePreview = 'visitor' | 'subscriber';

export interface ChannelPageArgs {
  channelId: string;
  slug: string | undefined;
  locale: string;
  viewerId: string | null;
  preview: ChannelPagePreview | null;
}

const pageKeys = {
  all: (channelId: string) => ['channels', 'page', channelId] as const,
  seed: (channelId: string) => ['channels', 'page-seed', channelId] as const,
  videos: (channelId: string, format: 'standard' | 'short') =>
    ['channels', 'page-videos', channelId, format] as const,
  playlists: (channelId: string) => ['channels', 'page-playlists', channelId] as const,
};

/** Every page of the channel, whatever the tab, viewer or preview, for one invalidation. */
export const channelPageScope = pageKeys.all;

/** What `random` orders by: the first answer's, kept so every tab of one visit shuffles the same way. */
export function rememberPageSeed(queryClient: QueryClient, channelId: string, seed: string) {
  queryClient.setQueryData(pageKeys.seed(channelId), seed);
}

export function pageSeedOf(queryClient: QueryClient, channelId: string): string | undefined {
  return queryClient.getQueryData<string>(pageKeys.seed(channelId));
}

/** One tab of the channel page as this viewer gets it, or as the draft would look to the previewed audience. */
export function channelPageQueryOptions(
  api: ApiClient,
  { channelId, slug, locale, viewerId, preview }: ChannelPageArgs,
  seed?: string
) {
  return queryOptions({
    queryKey: [
      ...pageKeys.all(channelId),
      slug ?? 'landing',
      locale,
      viewerId ?? 'guest',
      preview ?? 'public',
    ] as const,
    queryFn: () =>
      preview === null
        ? api.channelPage.getChannelPage({
            params: { idOrHandle: channelId },
            query: { tab: slug, locale, seed },
          })
        : api.channelPageStudio.previewChannelPage({
            query: { as: preview, tab: slug, locale, seed },
          }),
  });
}

export function channelVideosQueryOptions(
  api: ApiClient,
  channelId: string,
  format: 'standard' | 'short'
) {
  return infiniteQueryOptions({
    queryKey: pageKeys.videos(channelId, format),
    queryFn: ({ pageParam }) =>
      api.channelVideos.listChannelVideos({
        params: { idOrHandle: channelId },
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam, format },
      }),
    ...keysetPaging,
  });
}

export function channelPlaylistsQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: pageKeys.playlists(channelId),
    queryFn: () =>
      api.channelPlaylists.listChannelPlaylists({
        params: { idOrHandle: channelId },
        query: { limit: KEYSET_PAGE_SIZE },
      }),
  });
}

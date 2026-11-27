import { KEYSET_PAGE_SIZE, keysetPaging } from '@kit/query';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { PostStatus } from '@vp/domain';

export const postKeys = {
  all: ['studio', 'posts'] as const,
  channel: (channelId: string) => [...postKeys.all, channelId] as const,
  list: (channelId: string, status: PostStatus | undefined) =>
    [...postKeys.channel(channelId), 'list', status ?? 'all'] as const,
  stats: (channelId: string, id: string) => [...postKeys.channel(channelId), 'stats', id] as const,
  history: (channelId: string, id: string) =>
    [...postKeys.channel(channelId), 'history', id] as const,
  videos: (channelId: string) => [...postKeys.channel(channelId), 'videos'] as const,
  playlists: (channelId: string) => [...postKeys.channel(channelId), 'playlists'] as const,
};

/** The posts of one channel in any stage, newest first, keyset-paged; the channel is in the key so an identity never reads another's drafts. */
export function managedPostsQueryOptions(
  api: ApiClient,
  channelId: string,
  status: PostStatus | undefined
) {
  return infiniteQueryOptions({
    queryKey: postKeys.list(channelId, status),
    queryFn: ({ pageParam }) =>
      api.postStudio.listManagedPosts({
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam, ...(status && { status }) },
      }),
    ...keysetPaging,
  });
}

/** The saved states of one published post, newest first; the channel is in the key like every post read. */
export function postHistoryQueryOptions(api: ApiClient, channelId: string, id: string) {
  return infiniteQueryOptions({
    queryKey: postKeys.history(channelId, id),
    queryFn: ({ pageParam }) =>
      api.postRevisions.listPostRevisions({
        params: { id },
        query: { cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

export function postStatsQueryOptions(api: ApiClient, channelId: string, id: string) {
  return queryOptions({
    queryKey: postKeys.stats(channelId, id),
    queryFn: () => api.postStudio.getPostStats({ params: { id } }),
  });
}

/** The channel's public, ready videos a post can share, newest first. */
export function shareableVideosQueryOptions(api: ApiClient, channelId: string) {
  return infiniteQueryOptions({
    queryKey: postKeys.videos(channelId),
    queryFn: ({ pageParam }) =>
      api.creatorVideos.listCreatorVideos({
        query: {
          status: 'READY',
          visibility: 'public',
          sort: 'newest',
          limit: KEYSET_PAGE_SIZE,
          cursor: pageParam,
        },
      }),
    ...keysetPaging,
  });
}

/** The playlists the viewer owns that are public, which is what a post can share. */
export function shareablePlaylistsQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: postKeys.playlists(channelId),
    queryFn: async () =>
      (await api.playlists.listMyPlaylists({ query: {} })).items.filter(
        ({ visibility }) => visibility === 'public'
      ),
  });
}

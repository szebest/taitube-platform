import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

const SHELF_LIMIT = 12;

export const libraryKeys = {
  all: ['library'] as const,
  history: () => [...libraryKeys.all, 'history'] as const,
  searches: () => [...libraryKeys.all, 'searches'] as const,
  liked: () => [...libraryKeys.all, 'liked'] as const,
  comments: () => [...libraryKeys.all, 'comments'] as const,
  playlists: () => [...libraryKeys.all, 'playlists'] as const,
  playlistDetails: () => [...libraryKeys.all, 'playlist'] as const,
  playlist: (playlistId: string) => [...libraryKeys.playlistDetails(), playlistId] as const,
  saveTargets: (videoId: string) => [...libraryKeys.playlists(), 'save', videoId] as const,
  uploads: (channelId: string) => [...libraryKeys.all, 'uploads', channelId] as const,
};

export function watchHistoryQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: libraryKeys.history(),
    queryFn: ({ pageParam }) =>
      api.watchHistory.listWatchHistory({ query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam } }),
    ...keysetPaging,
  });
}

export function searchHistoryQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: libraryKeys.searches(),
    queryFn: ({ pageParam }) =>
      api.searchHistory.listSearchHistory({
        query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

export function likedVideosQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: libraryKeys.liked(),
    queryFn: ({ pageParam }) =>
      api.viewerActivity.listLikedVideos({ query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam } }),
    ...keysetPaging,
  });
}

export function myCommentsQueryOptions(api: ApiClient) {
  return infiniteQueryOptions({
    queryKey: libraryKeys.comments(),
    queryFn: ({ pageParam }) =>
      api.viewerActivity.listMyComments({ query: { limit: KEYSET_PAGE_SIZE, cursor: pageParam } }),
    ...keysetPaging,
  });
}

export function historyShelfQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: [...libraryKeys.history(), 'shelf'] as const,
    queryFn: () => api.watchHistory.listWatchHistory({ query: { limit: SHELF_LIMIT } }),
  });
}

export function myPlaylistsQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: libraryKeys.playlists(),
    queryFn: () => api.playlists.listMyPlaylists({ query: {} }),
  });
}

export function playlistQueryOptions(api: ApiClient, playlistId: string) {
  return queryOptions({
    queryKey: libraryKeys.playlist(playlistId),
    queryFn: () => api.playlists.getPlaylist({ params: { id: playlistId } }),
  });
}

export function uploadsShelfQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: libraryKeys.uploads(channelId),
    queryFn: () =>
      api.channelVideos.listChannelVideos({
        params: { idOrHandle: channelId },
        query: { limit: SHELF_LIMIT },
      }),
  });
}

/** The viewer's playlists, each flagged with whether it holds `videoId`: the save dialog's one round trip. */
export function saveTargetsQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: libraryKeys.saveTargets(videoId),
    queryFn: () => api.playlists.listMyPlaylists({ query: { videoId } }),
  });
}

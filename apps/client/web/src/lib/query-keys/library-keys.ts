import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

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

export function playlistQueryOptions(api: ApiClient, playlistId: string) {
  return queryOptions({
    queryKey: libraryKeys.playlist(playlistId),
    queryFn: () => api.playlists.getPlaylist({ params: { id: playlistId } }),
  });
}

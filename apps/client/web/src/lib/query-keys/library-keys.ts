import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

/** What hangs off one playlist: each lives under its key, so `playlist.updated` reaches it. */
type PlaylistPart = 'collaborators' | 'invites' | 'activity' | 'share-links' | 'stats' | 'items';

export const libraryKeys = {
  all: ['library'] as const,
  history: () => [...libraryKeys.all, 'history'] as const,
  searches: () => [...libraryKeys.all, 'searches'] as const,
  liked: () => [...libraryKeys.all, 'liked'] as const,
  comments: () => [...libraryKeys.all, 'comments'] as const,
  playlists: () => [...libraryKeys.all, 'playlists'] as const,
  playlistDetails: () => [...libraryKeys.all, 'playlist'] as const,
  playlist: (playlistId: string) => [...libraryKeys.playlistDetails(), playlistId] as const,
  playlistPart: (playlistId: string, part: PlaylistPart) =>
    [...libraryKeys.playlist(playlistId), part] as const,
  followed: () => [...libraryKeys.all, 'followed'] as const,
  saveTargets: (videoId: string) => [...libraryKeys.playlists(), 'save', videoId] as const,
  uploads: (channelId: string) => [...libraryKeys.all, 'uploads', channelId] as const,
};

/** `shareToken` is a share link's, sent with the read and kept out of the key: one playlist, one entry. */
export function playlistQueryOptions(api: ApiClient, playlistId: string, shareToken?: string) {
  return queryOptions({
    queryKey: libraryKeys.playlist(playlistId),
    queryFn: () =>
      api.playlists.getPlaylist({
        params: { id: playlistId },
        query: shareToken === undefined ? {} : { s: shareToken },
      }),
  });
}

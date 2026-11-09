import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { libraryKeys, playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { queryMutationOptions } from '../api/query-mutation';
import { useListMutation } from './use-list-mutation';

function removeItemMutationOptions(api: ApiClient, playlistId: string) {
  return queryMutationOptions({
    key: playlistQueryOptions(api, playlistId).queryKey,
    request: (videoId: string) =>
      api.playlists.removePlaylistItem({ params: { id: playlistId, videoId } }),
    edit: (playlist, videoId) => ({
      ...playlist,
      items: playlist.items.filter((item) => item.videoId !== videoId),
      videoCount: Math.max(0, playlist.videoCount - 1),
    }),
    invalidate: [libraryKeys.playlists(), libraryKeys.playlistDetails()],
  });
}

export function useRemovePlaylistItem(playlistId: string) {
  const api = useApi();
  return useListMutation(removeItemMutationOptions(api, playlistId));
}

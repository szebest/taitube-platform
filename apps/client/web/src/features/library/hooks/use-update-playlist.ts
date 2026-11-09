import type { ApiClient } from '@vp/api-client';
import type { PlaylistVisibility } from '@vp/domain';
import { useApi } from '@vp/queries';
import { libraryKeys, playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { queryMutationOptions } from '../api/query-mutation';
import { useListMutation } from './use-list-mutation';

interface PlaylistDetails {
  title: string;
  description: string;
  visibility: PlaylistVisibility;
}

function updateMutationOptions(api: ApiClient, playlistId: string) {
  return queryMutationOptions({
    key: playlistQueryOptions(api, playlistId).queryKey,
    request: (details: PlaylistDetails) =>
      api.playlists.updatePlaylist({ params: { id: playlistId }, body: details }),
    edit: (playlist, details) => ({ ...playlist, ...details }),
    invalidate: [libraryKeys.playlists(), libraryKeys.playlistDetails()],
  });
}

/** Renames, redescribes or changes who can see a playlist: the page shows the edit at once. */
export function useUpdatePlaylist(playlistId: string) {
  const api = useApi();
  return useListMutation(updateMutationOptions(api, playlistId));
}

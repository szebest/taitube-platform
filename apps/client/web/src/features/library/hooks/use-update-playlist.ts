import type { ApiClient } from '@vp/api-client';
import type { PlaylistPatch } from '@vp/domain';
import { useApi } from '@vp/queries';

import { libraryKeys, playlistQueryOptions } from '../api/library-queries';
import { queryMutationOptions } from './query-mutation';
import { useListMutation } from './use-list-mutation';

function updatePlaylistMutationOptions(api: ApiClient, playlistId: string) {
  return queryMutationOptions({
    key: playlistQueryOptions(api, playlistId).queryKey,
    request: (patch: PlaylistPatch) =>
      api.playlists.updatePlaylist({ params: { id: playlistId }, body: patch }),
    edit: (playlist, patch) => ({ ...playlist, ...patch }),
    invalidate: [libraryKeys.playlist(playlistId), libraryKeys.playlists()],
  });
}

/** The owner's edit of a playlist's title, description or visibility, shown at once and undone on a refusal. */
export function useUpdatePlaylist(playlistId: string) {
  const api = useApi();
  return useListMutation(updatePlaylistMutationOptions(api, playlistId));
}

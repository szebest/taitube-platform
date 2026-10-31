import { mutationOptions } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

import { libraryKeys } from '../api/library-queries';
import { useListMutation } from './use-list-mutation';

function deletePlaylistMutationOptions(api: ApiClient, playlistId: string) {
  return mutationOptions({
    mutationFn: () => api.playlists.deletePlaylist({ params: { id: playlistId } }),
    onSettled: (_result, _error, _variables, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: libraryKeys.playlists() }),
  });
}

/** Deletes a playlist and leaves its page for the You hub, then forgets what the page held. */
export function useDeletePlaylist(playlistId: string) {
  const api = useApi();
  const navigate = useNavigate();

  return useListMutation({
    ...deletePlaylistMutationOptions(api, playlistId),
    onSuccess: async (_result, _variables, _snapshot, { client }) => {
      await navigate({ to: '/feed/you' });
      client.removeQueries({ queryKey: libraryKeys.playlist(playlistId) });
    },
  });
}

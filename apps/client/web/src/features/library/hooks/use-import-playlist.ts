import { mutationOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import type { ImportFormat } from '../utils/import-content';
import { useListMutation } from './use-list-mutation';

function importMutationOptions(api: ApiClient, playlistId: string) {
  return mutationOptions({
    mutationFn: (body: { format: ImportFormat; content: string }) =>
      api.playlistTransfer.importPlaylist({ params: { id: playlistId }, body }),
    onSettled: (_result, _error, _body, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: libraryKeys.playlist(playlistId) }),
        client.invalidateQueries({ queryKey: libraryKeys.playlists() }),
      ]),
  });
}

/** Sends pasted or picked text to the playlist; the answer reports each line. */
export function useImportPlaylist(playlistId: string) {
  const api = useApi();
  return useListMutation(importMutationOptions(api, playlistId));
}

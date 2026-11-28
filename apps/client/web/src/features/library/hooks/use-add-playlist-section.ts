import { mutationOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useListMutation } from './use-list-mutation';

function addSectionMutationOptions(api: ApiClient, playlistId: string) {
  return mutationOptions({
    mutationFn: (title: string) =>
      api.playlistItems.addPlaylistSection({ params: { id: playlistId }, body: { title } }),
    onSettled: (_result, _error, _title, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: libraryKeys.playlist(playlistId) }),
  });
}

/** Appends a section to the playlist; it lands at the end and moves like an item. */
export function useAddPlaylistSection(playlistId: string) {
  const api = useApi();
  return useListMutation(addSectionMutationOptions(api, playlistId));
}

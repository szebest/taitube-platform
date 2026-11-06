import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { libraryKeys, playlistQueryOptions } from '../api/library-queries';
import { queryMutationOptions } from '../api/query-mutation';
import { useListMutation } from './use-list-mutation';

function reorderMutationOptions(api: ApiClient, playlistId: string) {
  return queryMutationOptions({
    key: playlistQueryOptions(api, playlistId).queryKey,
    request: (itemIds: readonly string[]) =>
      api.playlists.reorderPlaylist({
        params: { id: playlistId },
        body: { itemIds: [...itemIds] },
      }),
    edit: (playlist, itemIds) => ({
      ...playlist,
      items: itemIds.flatMap((id) => playlist.items.find((item) => item.id === id) ?? []),
    }),
    invalidate: [libraryKeys.playlistDetails()],
  });
}

/** Puts a playlist's items in the order given: the list shows it at once and a refusal puts the old order back. */
export function useReorderPlaylist(playlistId: string) {
  const api = useApi();
  return useListMutation(reorderMutationOptions(api, playlistId));
}

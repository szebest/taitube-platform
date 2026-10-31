import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { libraryKeys, playlistQueryOptions } from '../api/library-queries';
import { applyMove, type ItemMove } from '../api/playlist-order';
import { queryMutationOptions } from './query-mutation';
import { useListMutation } from './use-list-mutation';

function reorderMutationOptions(api: ApiClient, playlistId: string) {
  return queryMutationOptions({
    key: playlistQueryOptions(api, playlistId).queryKey,
    request: ({ itemId, newPosition }: ItemMove) =>
      api.playlists.reorderPlaylist({ params: { id: playlistId }, body: { itemId, newPosition } }),
    edit: (playlist, move) => ({ ...playlist, items: applyMove(playlist.items, move) }),
    invalidate: [libraryKeys.playlist(playlistId)],
  });
}

/** Moves one item: the list shows the new order on the drop, one request follows, a refusal puts it back. */
export function useReorderPlaylist(playlistId: string) {
  const api = useApi();
  return useListMutation(reorderMutationOptions(api, playlistId));
}

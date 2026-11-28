import { mutationOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useListMutation } from './use-list-mutation';

interface PlaylistTransfer {
  itemIds: readonly string[];
  to: string;
  mode: 'move' | 'copy';
}

function transferMutationOptions(api: ApiClient, playlistId: string) {
  return mutationOptions({
    mutationFn: ({ itemIds, to, mode }: PlaylistTransfer) =>
      api.playlistTransfer.transferPlaylistItems({
        params: { id: playlistId },
        body: { itemIds: [...itemIds], to, mode },
      }),
    onSettled: (_result, _error, _transfer, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: libraryKeys.playlistDetails() }),
        client.invalidateQueries({ queryKey: libraryKeys.playlists() }),
      ]),
  });
}

/** Moves or copies items to another playlist; the answer says, item by item, what landed. */
export function useTransferPlaylistItems(playlistId: string) {
  const api = useApi();
  return useListMutation(transferMutationOptions(api, playlistId));
}

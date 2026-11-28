import { useToast } from '@kit/ui';
import { mutationOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { PlaylistItemSort } from '@vp/domain';
import { useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useListMutation } from './use-list-mutation';

function sortMutationOptions(api: ApiClient, playlistId: string) {
  return mutationOptions({
    mutationFn: (sort: Exclude<PlaylistItemSort, 'manual'>) =>
      api.playlistItems.sortPlaylist({ params: { id: playlistId }, body: { sort } }),
    onSettled: (_result, _error, _sort, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: libraryKeys.playlist(playlistId) }),
  });
}

/** Writes a viewing order back as the playlist's own order. */
export function useSortPlaylist(playlistId: string) {
  const api = useApi();
  const showToast = useToast();
  const { tOr } = useT();

  return useListMutation({
    ...sortMutationOptions(api, playlistId),
    onSuccess: () => showToast({ tone: 'success', title: tOr('playlistEdit.orderSaved', {}, '') }),
  });
}

import { useToast } from '@kit/ui';
import { mutationOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useListMutation } from './use-list-mutation';

function unfollowMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: (playlistId: string) =>
      api.playlistLibrary.unfollowPlaylist({ params: { id: playlistId } }),
    onSettled: (_result, _error, _playlistId, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: libraryKeys.followed() }),
  });
}

/** Drops a followed playlist from the library, whether or not it can still be read. */
export function useUnfollowPlaylist() {
  const api = useApi();
  const showToast = useToast();
  const { tOr } = useT();

  return useListMutation({
    ...unfollowMutationOptions(api),
    onSuccess: () => showToast({ tone: 'success', title: tOr('playlistEdit.unfollowed', {}, '') }),
  });
}

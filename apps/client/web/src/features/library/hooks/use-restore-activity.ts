import { useToast } from '@kit/ui';
import { mutationOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useListMutation } from './use-list-mutation';

function restoreActivityMutationOptions(api: ApiClient, playlistId: string) {
  return mutationOptions({
    mutationFn: (activityId: string) =>
      api.playlistActivity.restorePlaylistActivity({ params: { id: playlistId, activityId } }),
    onSettled: (_data, _error, _activityId, _context, { client }) =>
      client.invalidateQueries({ queryKey: libraryKeys.playlist(playlistId) }),
  });
}

/** Puts a removed item back at the end; a video the playlist holds again is refused with the reason. */
export function useRestoreActivity(playlistId: string) {
  const showToast = useToast();
  const { tOr } = useT();

  return useListMutation({
    ...restoreActivityMutationOptions(useApi(), playlistId),
    onSuccess: () => showToast({ tone: 'success', title: tOr('playlistPeople.restored', {}, '') }),
  });
}

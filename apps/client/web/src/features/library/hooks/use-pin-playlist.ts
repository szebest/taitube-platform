import { useToast } from '@kit/ui';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { libraryKeys, playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { queryMutationOptions } from '../api/query-mutation';
import { useListMutation } from './use-list-mutation';

function pinPlaylistMutationOptions(api: ApiClient, playlistId: string) {
  const key = playlistQueryOptions(api, playlistId).queryKey;

  return queryMutationOptions({
    key,
    request: (pin: boolean) =>
      pin
        ? api.playlistLibrary.pinPlaylist({ params: { id: playlistId } })
        : api.playlistLibrary.unpinPlaylist({ params: { id: playlistId } }),
    edit: (playlist, pin) => ({ ...playlist, pinnedAt: pin ? new Date().toISOString() : null }),
    invalidate: [key, libraryKeys.playlists()],
  });
}

/** Puts the playlist on the library's shelves or takes it off; a full set of pins says why it was refused. */
export function usePinPlaylist(playlistId: string) {
  const api = useApi();
  const showToast = useToast();
  const { tOr } = useT();

  return useListMutation({
    ...pinPlaylistMutationOptions(api, playlistId),
    onSuccess: (_result, pin) =>
      showToast({
        tone: 'success',
        title: tOr(pin ? 'playlistPeople.pinned' : 'playlistPeople.unpinned', {}, ''),
      }),
  });
}

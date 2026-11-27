import { useToast } from '@kit/ui';
import { mutationOptions } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useListMutation } from './use-list-mutation';

/** fork: a copy of anything the viewer can read; freeze: what a smart playlist holds now. */
type PlaylistCopy = 'fork' | 'freeze';

const TOAST = { fork: 'playlistPeople.forked', freeze: 'playlistPeople.frozen' } as const;

function copyPlaylistMutationOptions(api: ApiClient, playlistId: string, copy: PlaylistCopy) {
  return mutationOptions({
    mutationFn: () =>
      copy === 'fork'
        ? api.playlistLibrary.forkPlaylist({ params: { id: playlistId } })
        : api.playlistLibrary.freezePlaylist({ params: { id: playlistId } }),
    onSettled: (_playlist, _error, _variables, _context, { client }) =>
      client.invalidateQueries({ queryKey: libraryKeys.playlists() }),
  });
}

/** Makes a new private playlist of the viewer's from this one, says so and opens it. */
export function useCopyPlaylist(playlistId: string, copy: PlaylistCopy) {
  const api = useApi();
  const navigate = useNavigate();
  const showToast = useToast();
  const { tOr } = useT();

  return useListMutation({
    ...copyPlaylistMutationOptions(api, playlistId, copy),
    onSuccess: ({ id, title }) => {
      showToast({ tone: 'success', title: tOr(TOAST[copy], { title }, '') });
      return navigate({ to: '/playlist', search: { list: id } });
    },
  });
}

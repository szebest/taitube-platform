import { useToast } from '@kit/ui';
import { mutationOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { PlaylistVisibility } from '@vp/domain';
import { useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import type { PlaylistRulesBody } from '../utils/rules-form';
import { useListMutation } from './use-list-mutation';

interface NewPlaylist {
  title: string;
  visibility: PlaylistVisibility;
  /** A video the new playlist starts with. */
  videoId?: string;
  /** Makes it smart: it picks its own videos from these and takes none by hand. */
  rules?: PlaylistRulesBody;
}

function createPlaylistMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: async ({ title, visibility, videoId, rules }: NewPlaylist) => {
      const playlist = await api.playlists.createPlaylist({ body: { title, visibility, rules } });
      if (videoId !== undefined) {
        await api.playlists.addPlaylistItem({ params: { id: playlist.id }, body: { videoId } });
      }
      return playlist;
    },
    onSettled: (_playlist, _error, _variables, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: libraryKeys.playlists() }),
        client.invalidateQueries({ queryKey: libraryKeys.playlistDetails() }),
      ]),
  });
}

/** Creates a playlist, and puts the video in it when one is given. */
export function useCreatePlaylist() {
  const api = useApi();
  const showToast = useToast();
  const { tOr } = useT();

  return useListMutation({
    ...createPlaylistMutationOptions(api),
    onSuccess: ({ title }, { videoId }) =>
      showToast({
        tone: 'success',
        title: tOr(
          videoId === undefined ? 'library.playlistCreated' : 'library.savedTo',
          { title },
          ''
        ),
      }),
  });
}

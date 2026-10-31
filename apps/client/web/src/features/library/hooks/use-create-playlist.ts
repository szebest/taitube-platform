import { mutationOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { PlaylistVisibility } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { useToast } from '@vp/ui';

import { libraryKeys } from '../api/library-queries';
import { useListMutation } from './use-list-mutation';

interface NewPlaylist {
  title: string;
  visibility: PlaylistVisibility;
  /** A video the new playlist starts with. */
  videoId?: string;
}

function createPlaylistMutationOptions(api: ApiClient) {
  return mutationOptions({
    mutationFn: async ({ title, visibility, videoId }: NewPlaylist) => {
      const playlist = await api.playlists.createPlaylist({ body: { title, visibility } });
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

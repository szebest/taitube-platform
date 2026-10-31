import type { ApiClient } from '@vp/api-client';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { useToast } from '@vp/ui';

import { libraryKeys, saveTargetsQueryOptions } from '../api/library-queries';
import { queryMutationOptions } from './query-mutation';
import { useListMutation } from './use-list-mutation';

interface PlaylistToggle {
  playlistId: string;
  title: string;
  saved: boolean;
}

function toggleMutationOptions(api: ApiClient, videoId: string) {
  return queryMutationOptions({
    key: saveTargetsQueryOptions(api, videoId).queryKey,
    request: ({ playlistId, saved }: PlaylistToggle) =>
      saved
        ? api.playlists.addPlaylistItem({ params: { id: playlistId }, body: { videoId } })
        : api.playlists.removePlaylistItem({ params: { id: playlistId, videoId } }),
    edit: (data, { playlistId, saved }) => ({
      ...data,
      items: data.items.map((playlist) =>
        playlist.id === playlistId
          ? {
              ...playlist,
              containsVideo: saved,
              videoCount: Math.max(0, playlist.videoCount + (saved ? 1 : -1)),
            }
          : playlist
      ),
    }),
    invalidate: [libraryKeys.playlists(), libraryKeys.playlistDetails()],
  });
}

/** Puts `videoId` in a playlist or takes it out: the checkbox shows the change at once and a refusal undoes it. */
export function useTogglePlaylistItem(videoId: string) {
  const api = useApi();
  const showToast = useToast();
  const { tOr } = useT();

  return useListMutation({
    ...toggleMutationOptions(api, videoId),
    onSuccess: (_result, { title, saved }) =>
      showToast({
        tone: 'success',
        title: tOr(saved ? 'library.savedTo' : 'library.removedFrom', { title }, ''),
      }),
  });
}

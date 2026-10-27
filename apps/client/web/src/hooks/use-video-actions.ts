import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useCan } from '@vp/permissions-react';
import { useApi } from '@vp/queries';

/** What a viewer can do to a video from a card; an action left out is not offered. */
export interface VideoActions {
  save?: () => void;
  enqueue?: () => void;
}

function saveToWatchLaterMutationOptions(api: ApiClient, videoId: string) {
  return mutationOptions({
    mutationKey: ['playlists', 'watch-later', videoId],
    mutationFn: async () => {
      const { items } = await api.playlists.listMyPlaylists({ query: { videoId } });
      const watchLater = items.find((playlist) => playlist.isSystem);
      if (!watchLater || watchLater.containsVideo) return;

      await api.playlists.addPlaylistItem({ params: { id: watchLater.id }, body: { videoId } });
    },
  });
}

/**
 * Save puts the video on the viewer's Watch Later list and is offered to a member only. Enqueue
 * waits for the player queue (73) and is never offered until then.
 */
export function useVideoActions(videoId: string): VideoActions {
  const api = useApi();
  const canSave = useCan('create', 'Playlist');
  const { mutate } = useMutation(saveToWatchLaterMutationOptions(api, videoId));

  return { save: canSave ? () => mutate() : undefined };
}

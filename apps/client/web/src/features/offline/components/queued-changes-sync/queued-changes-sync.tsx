import { useQueryClient } from '@tanstack/react-query';
import { useApi, videoQueryOptions } from '@vp/queries';
import { useEffect, useEffectEvent } from 'react';
import { listenForSync } from '#app/features/offline/utils/sync-channel';
import { commentKeys } from '#app/lib/query-keys/comment-keys';
import { myReactionQueryOptions } from '#app/lib/query-keys/reaction-keys';

/**
 * Refetches a video's reaction, counts and comments once the service worker has replayed what the
 * viewer did offline. It renders nothing and is mounted once, in the shell.
 */
export function QueuedChangesSync() {
  const api = useApi();
  const client = useQueryClient();

  const refresh = useEffectEvent((videoIds: string[]) =>
    Promise.all(
      videoIds.flatMap((videoId) => [
        client.invalidateQueries({ queryKey: myReactionQueryOptions(api, videoId).queryKey }),
        client.invalidateQueries({ queryKey: videoQueryOptions(api, videoId).queryKey }),
        client.invalidateQueries({ queryKey: commentKeys.video(videoId) }),
      ])
    )
  );

  useEffect(() => {
    const stopListening = listenForSync((message) => {
      if (message.type === 'replayed') {
        void refresh(message.videoIds);
      }
    });
    return () => stopListening();
  }, []);

  return null;
}

import { useQueryClient } from '@tanstack/react-query';
import { useApi, videoQueryOptions } from '@vp/queries';
import { useEffect, useEffectEvent } from 'react';
import { myReactionQueryOptions } from '#app/features/reactions/api/reaction-queries';
import { commentKeys } from '#app/features/watch/api/comment-queries';
import { listenForSync } from '../sync-channel';

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

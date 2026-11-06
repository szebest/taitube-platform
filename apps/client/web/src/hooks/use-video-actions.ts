import type { VideoSummary } from '@vp/api-contracts';
import { useCan } from '@vp/permissions-react';
import { use } from 'react';
import { PlaybackSessionContext } from '#app/features/watch/components/playback-session-provider/playback-session.context';
import { urlModals } from '#app/lib/url-modal/registry';

/** What a viewer can do to a video from a card; an action left out is not offered. */
export interface VideoActions {
  save?: () => void;
  enqueue?: () => void;
}

/**
 * Save opens the save-to-playlist dialog and is offered to a member only. Enqueue adds the video
 * to the queue wherever there is one, to a guest too, and never for a Short, which plays in its own feed.
 */
export function useVideoActions(video: VideoSummary): VideoActions {
  const canSave = useCan('create', 'Playlist');
  const { open } = urlModals.useUrlModal('save-to-playlist');
  const playback = use(PlaybackSessionContext);

  return {
    save: canSave ? () => open({ videoId: video.id }) : undefined,
    enqueue:
      playback && video.format !== 'short'
        ? () => playback.dispatch({ type: 'append', video })
        : undefined,
  };
}

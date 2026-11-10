import type { VideoSummary } from '@vp/api-contracts';
import { use } from 'react';
import { urlModals } from '#app/lib/url-modal/registry';
import { PlaybackSessionContext } from '../lib/playback-session/playback-session.context';
import { useRequireAccount } from './use-require-account';

/** What a viewer can do to a video from a card; an action left out is not offered. */
export interface VideoActions {
  save?: () => void;
  enqueue?: () => void;
}

/**
 * Save opens the save-to-playlist dialog and enqueue adds the video to the queue wherever there is one,
 * never for a Short, which plays in its own feed. A guest sees both, and each opens the sign-in prompt.
 */
export function useVideoActions(video: VideoSummary): VideoActions {
  const save = useRequireAccount('save');
  const queue = useRequireAccount('queue');
  const { open } = urlModals.useUrlModal('save-to-playlist');
  const playback = use(PlaybackSessionContext);

  return {
    save: () => save.run(() => open({ videoId: video.id }), { kind: 'save', id: video.id }),
    enqueue:
      playback && video.format !== 'short'
        ? () => queue.run(() => playback.dispatch({ type: 'append', video }))
        : undefined,
  };
}

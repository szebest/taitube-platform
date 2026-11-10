import type { VideoSummary } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useToast } from '@vp/ui';
import { use } from 'react';
import { urlModals } from '#app/lib/url-modal/registry';
import { PlaybackSessionContext } from '../lib/playback-session/playback-session.context';
import { useRequireAccount } from './use-require-account';

/** What a viewer can do to a video from a card; an action left out is not offered. */
export interface VideoActions {
  save?: () => void;
  enqueue?: () => void;
  playNext?: () => void;
}

/**
 * Save opens the save-to-playlist dialog; enqueue and play next change the queue wherever there is one,
 * and each says so with a toast whose Undo puts the queue back. A guest sees every action, and each opens
 * the sign-in prompt.
 */
export function useVideoActions(video: VideoSummary): VideoActions {
  const save = useRequireAccount('save');
  const queue = useRequireAccount('queue');
  const { open } = urlModals.useUrlModal('save-to-playlist');
  const playback = use(PlaybackSessionContext);
  const showToast = useToast();
  const { tOr } = useT();

  const undoAction = (onAction: () => void) => ({
    label: tOr('watch.queueUndo', {}, ''),
    onAction,
  });

  const enqueue = () => {
    if (!playback) return;
    if (playback.session.videos.some(({ id }) => id === video.id)) {
      showToast({ title: tOr('watch.alreadyQueued', {}, '') });
      return;
    }

    playback.dispatch({ type: 'append', video });
    showToast({
      tone: 'success',
      title: tOr('watch.queuedToast', {}, ''),
      action: undoAction(() => playback.dispatch({ type: 'remove', id: video.id })),
    });
  };

  const playNext = () => {
    if (!playback) return;
    if (playback.session.current?.video.id === video.id) {
      showToast({ title: tOr('watch.alreadyQueued', {}, '') });
      return;
    }

    const before = playback.session.videos.findIndex(({ id }) => id === video.id);
    playback.dispatch({ type: 'playNext', video });
    showToast({
      tone: 'success',
      title: tOr('watch.playNextToast', {}, ''),
      action: undoAction(() =>
        playback.dispatch(
          before < 0
            ? { type: 'remove', id: video.id }
            : { type: 'reorder', id: video.id, toIndex: before }
        )
      ),
    });
  };

  return {
    save: () => save.run(() => open({ videoId: video.id }), { kind: 'save', id: video.id }),
    enqueue: playback ? () => queue.run(enqueue) : undefined,
    playNext: playback ? () => queue.run(playNext) : undefined,
  };
}

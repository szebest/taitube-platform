import type { VideoSummary } from '@vp/api-contracts';
import { useOnPlayerEnded } from '#app/features/player';
import { usePlaybackPreference } from '#app/features/settings/device/device-preferences-provider';
import { usePlaybackQueue } from './use-playback-queue';
import { useQueueNavigation } from './use-queue-navigation';

/** Opens the video after the current one in the queue, or the first recommendation, once the playing video ends. */
export function useAutoplayNext(recommended: readonly VideoSummary[] = []) {
  const [autoplayNext] = usePlaybackPreference('autoplayNext');
  const queue = usePlaybackQueue();
  const { open } = useQueueNavigation();

  useOnPlayerEnded(() => {
    const next = queue.next() ?? recommended[0];
    if (!autoplayNext || next === undefined) {
      return;
    }

    open(next);
  });
}

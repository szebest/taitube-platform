import type { VideoSummary } from '@vp/api-contracts';
import { useOnPlayerEnded } from '#app/components/player/taitube-player';
import { usePlaybackQueue } from '#app/hooks/use-playback-queue';
import { usePlaybackPreference } from '#app/lib/preferences/device-preferences-provider';
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

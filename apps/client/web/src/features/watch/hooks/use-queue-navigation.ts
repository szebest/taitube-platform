import { useNavigate } from '@tanstack/react-router';
import type { VideoSummary } from '@vp/api-contracts';

import { useIsWatching } from './use-is-watching';
import { usePlaybackQueue } from './use-playback-queue';

/** Moves playback through the queue; on a watch page it also moves the page, so the address always names what plays. */
export function useQueueNavigation() {
  const queue = usePlaybackQueue();
  const navigate = useNavigate();
  const watching = useIsWatching();

  const open = (
    video: VideoSummary,
    { back = false, replace }: { back?: boolean; replace?: boolean } = {}
  ) => {
    queue.go(video, back);
    if (!watching) {
      return;
    }

    const index = queue.videos.findIndex(({ id }) => id === video.id);
    navigate({
      to: '/watch/$videoId',
      params: { videoId: video.id },
      search: queue.playlistId && index >= 0 ? { list: queue.playlistId, index } : {},
      replace: replace ?? index >= 0,
      state: { autoplay: true },
    });
  };

  return {
    open,
    next: () => {
      const video = queue.next();
      if (video) {
        open(video);
      }
    },
    previous: () => {
      const video = queue.previous();
      if (video) {
        open(video, { back: true });
      }
    },
    hasNext: queue.next() !== undefined,
    hasPrevious: queue.previous() !== undefined,
  };
}

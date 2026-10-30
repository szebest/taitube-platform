import type { VideoSummary } from '@vp/api-contracts';
import { useState } from 'react';

/**
 * The viewer's queue on this page. Nothing outside the page holds a queue yet (73 gives it a playlist
 * and the now playing bar), so the page seeds it with the video it opened and owns the order and removals.
 */
export function usePlaybackQueue(initial: readonly VideoSummary[]) {
  const [videos, setVideos] = useState(initial);

  const reorder = (id: string, toIndex: number) =>
    setVideos((queued) => {
      const picked = queued.find((video) => video.id === id);
      if (!picked) {
        return queued;
      }

      const rest = queued.filter((video) => video.id !== id);
      return [...rest.slice(0, toIndex), picked, ...rest.slice(toIndex)];
    });

  const remove = (id: string) => setVideos((queued) => queued.filter((video) => video.id !== id));

  return { videos, reorder, remove };
}

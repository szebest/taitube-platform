import type { VideoSummary } from '@vp/api-contracts';

const MS_PER_SECOND = 1000;

/**
 * How much of a video the signed-in viewer watched, 0 to 1, from the playhead every summary list
 * carries (100's batched join). `undefined` hides the bar: a guest, a video not started, or one
 * whose duration is not known yet.
 */
export function useWatchProgress({
  durationMs,
  viewer,
}: Pick<VideoSummary, 'durationMs' | 'viewer'>): number | undefined {
  if (!(viewer && durationMs) || viewer.progressSeconds === 0) {
    return undefined;
  }

  return Math.min((viewer.progressSeconds * MS_PER_SECOND) / durationMs, 1);
}

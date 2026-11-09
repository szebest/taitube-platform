import { SERIES_EPISODE_DONE_PERCENT } from './playlist';

export interface EpisodeProgress {
  videoId: string;
  /** How much of the episode the viewer has watched, 0 to 100; `null` when they never started it. */
  percent: number | null;
  watchedAt: Date | null;
}

export function percentWatched(
  progressSeconds: number,
  durationMs: number | undefined
): number | null {
  if (!durationMs || durationMs <= 0) return null;
  return Math.min(100, Math.max(0, (progressSeconds * 1000 * 100) / durationMs));
}

const unfinished = ({ percent }: EpisodeProgress) =>
  percent === null || percent < SERIES_EPISODE_DONE_PERCENT;

/**
 * "Continue": the first episode after the one watched last that is not finished, else the first
 * unfinished one anywhere, else nothing. Episodes come in series order.
 */
export function nextEpisode(episodes: readonly EpisodeProgress[]): string | null {
  let lastWatched = -1;
  let latest = Number.NEGATIVE_INFINITY;
  episodes.forEach(({ watchedAt }, index) => {
    if (watchedAt && watchedAt.getTime() >= latest) {
      latest = watchedAt.getTime();
      lastWatched = index;
    }
  });

  const after = episodes.slice(lastWatched + 1).find(unfinished);
  return (after ?? episodes.find(unfinished))?.videoId ?? null;
}

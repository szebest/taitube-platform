import type { ChannelCard } from './channel';
import type { Video } from './video';

/** A video watched this far counts as finished: the end card and credits are not worth resuming. */
const WATCH_COMPLETION_RATIO = 0.92;

export interface WatchProgress {
  videoId: string;
  progressSeconds: number;
  durationSeconds: number;
  watchedAt: Date;
}

export interface NewWatchProgress extends WatchProgress {
  id: string;
  userId: string;
}

export interface WatchHistoryEntry extends WatchProgress {
  id: string;
  video: Video;
  channel: ChannelCard | null;
}

type Playhead = Pick<WatchProgress, 'progressSeconds' | 'durationSeconds'>;

export function isWatchCompleted({ progressSeconds, durationSeconds }: Playhead): boolean {
  return progressSeconds >= durationSeconds * WATCH_COMPLETION_RATIO;
}

export function watchedPercent({ progressSeconds, durationSeconds }: Playhead): number {
  return Math.floor((progressSeconds / durationSeconds) * 100);
}

/** A finished video starts over, the way a player offers a replay rather than the last frame. */
export function resumeAtSeconds(playhead: Playhead): number {
  return isWatchCompleted(playhead) ? 0 : playhead.progressSeconds;
}

export function clampProgress(progressSeconds: number, durationSeconds: number): number {
  return Math.min(progressSeconds, durationSeconds);
}

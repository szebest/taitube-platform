import type { ViewDate } from './views';

export const PLAYLIST_STATS_RANGES = ['7d', '30d', '90d'] as const;
export type PlaylistStatsRange = (typeof PLAYLIST_STATS_RANGES)[number];

export const PLAYLIST_TOP_ITEMS = 5;

export const PLAYLIST_MEASURES = ['opens', 'plays', 'follows', 'forks'] as const;
export type PlaylistMeasure = (typeof PLAYLIST_MEASURES)[number];

/** One thing that happened to a playlist, as the API hands it to the buffer; opens go apart, deduplicated. */
export type PlaylistEvent =
  | { readonly measure: 'follows' | 'forks'; readonly playlistId: string }
  | { readonly measure: 'plays'; readonly playlistId: string; readonly videoId: string };

/**
 * One playlist's numbers for one day. A play names its video, so the flush adds it to the
 * playlist's day and to that video's day in the playlist; every other measure names none.
 */
export interface PlaylistCount {
  readonly playlistId: string;
  readonly videoId: string | null;
  readonly viewDate: ViewDate;
  readonly opens: number;
  readonly plays: number;
  readonly follows: number;
  readonly forks: number;
}

export const NO_PLAYLIST_COUNTS = { opens: 0, plays: 0, follows: 0, forks: 0 } as const;

/** Adds the counts of the same playlist, video and day together, so a batch writes one row each. */
export function mergePlaylistCounts(counts: readonly PlaylistCount[]): PlaylistCount[] {
  const merged = new Map<string, PlaylistCount>();
  for (const count of counts) {
    const key = `${count.playlistId}|${count.videoId ?? ''}|${count.viewDate}`;
    const held = merged.get(key);
    merged.set(
      key,
      held
        ? {
            ...held,
            opens: held.opens + count.opens,
            plays: held.plays + count.plays,
            follows: held.follows + count.follows,
            forks: held.forks + count.forks,
          }
        : count
    );
  }
  return [...merged.values()];
}

export interface PlaylistTotals {
  readonly opens: number;
  readonly plays: number;
  readonly follows: number;
  readonly forks: number;
}

export interface PlaylistTopItem {
  readonly videoId: string;
  readonly plays: number;
}

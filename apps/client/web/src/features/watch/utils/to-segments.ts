import type { PlaylistView } from '@vp/api-contracts';
import type { PlaybackRange } from '#app/lib/player/taitube-player-props';

/** The stretch each playlist item plays, by video id: only an item with a start or an end has one, and a missing end is the video's own. */
export function toSegments(
  items: readonly Pick<PlaylistView['items'][number], 'startMs' | 'endMs' | 'video'>[]
): Record<string, PlaybackRange> {
  return Object.fromEntries(
    items
      .filter(({ startMs, endMs }) => startMs !== null || endMs !== null)
      .map(({ startMs, endMs, video }) => [
        video.id,
        { startMs: startMs ?? 0, endMs: endMs ?? video.durationMs ?? Number.POSITIVE_INFINITY },
      ])
  );
}

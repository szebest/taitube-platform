import { type Result, ok } from '@kit/result';
import type { PlaylistStatsRead, PlaylistStatsRepositoryPort } from '@vp/core/repositories';
import {
  PLAYLIST_TOP_ITEMS,
  type PlaylistCount,
  type ViewDateRange,
  mergePlaylistCounts,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

interface StatsDeps {
  /** Whether the playlist still exists, as a flush leaves out one deleted since the beacon. */
  hasPlaylist(playlistId: string): boolean;
  /** Whether the playlist holds the video, as a play of any other one is not counted. */
  holds(playlistId: string, videoId: string): boolean;
  titleOf(videoId: string): string | null;
}

/** The flushed playlist days, kept as the counts the flush handed over. */
export class InMemoryPlaylistStatsRepository implements PlaylistStatsRepositoryPort {
  private counts: PlaylistCount[] = [];

  constructor(private readonly deps: StatsDeps) {}

  addStats(counts: readonly PlaylistCount[]): void {
    const kept = counts.filter(
      ({ playlistId, videoId }) =>
        this.deps.hasPlaylist(playlistId) &&
        (videoId === null || this.deps.holds(playlistId, videoId))
    );
    this.counts = mergePlaylistCounts([...this.counts, ...kept]);
  }

  async statsOf(
    playlistId: string,
    { from, to }: ViewDateRange
  ): Promise<Result<PlaylistStatsRead, DatabaseUnavailable>> {
    const days = this.counts.filter(
      (count) => count.playlistId === playlistId && count.viewDate >= from && count.viewDate <= to
    );
    const totals = days.reduce(
      (sum, count) => ({
        opens: sum.opens + count.opens,
        plays: sum.plays + count.plays,
        follows: sum.follows + count.follows,
        forks: sum.forks + count.forks,
      }),
      { opens: 0, plays: 0, follows: 0, forks: 0 }
    );
    const byVideo = new Map<string, number>();
    for (const { videoId, plays } of days) {
      if (videoId !== null && this.deps.holds(playlistId, videoId))
        byVideo.set(videoId, (byVideo.get(videoId) ?? 0) + plays);
    }
    const topItems = [...byVideo]
      .sort(([leftId, left], [rightId, right]) => right - left || leftId.localeCompare(rightId))
      .slice(0, PLAYLIST_TOP_ITEMS)
      .map(([videoId, plays]) => ({ videoId, plays, title: this.deps.titleOf(videoId) ?? '' }));
    return ok({ totals, topItems });
  }

  clear(): void {
    this.counts = [];
  }
}

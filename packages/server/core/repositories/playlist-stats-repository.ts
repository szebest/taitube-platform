import type { Result } from '@kit/result';
import type { PlaylistTopItem, PlaylistTotals, ViewDateRange } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export interface PlaylistStatsRead {
  totals: PlaylistTotals;
  /** Most plays first, ties by video id, up to `PLAYLIST_TOP_ITEMS`. */
  topItems: (PlaylistTopItem & { title: string })[];
}

/** The flushed days of one playlist; the buffer's last minutes are not in them yet. */
export interface PlaylistStatsRepositoryPort {
  statsOf(
    playlistId: string,
    range: ViewDateRange
  ): Promise<Result<PlaylistStatsRead, DatabaseUnavailable>>;
}

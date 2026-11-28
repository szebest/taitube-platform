import type { Result } from '@kit/result';
import type { DatabaseUnavailable } from '@vp/errors';

export interface ContentLinkStatCounts {
  impressions: number;
  clicks: number;
  watchSeconds: number;
}

export interface ContentLinkDayCounts extends ContentLinkStatCounts {
  linkId: string;
  day: string;
}

export interface ContentLinkStatsRepositoryPort {
  /** Adds each count to its link's day, creating the row; counts for a link that is gone are dropped. */
  addDaily(counts: readonly ContentLinkDayCounts[]): Promise<Result<void, DatabaseUnavailable>>;
  /** Every flushed day added up; every id gets an entry, zero for a link nobody saw. */
  totalsFor(
    linkIds: readonly string[]
  ): Promise<Result<Map<string, ContentLinkStatCounts>, DatabaseUnavailable>>;
}

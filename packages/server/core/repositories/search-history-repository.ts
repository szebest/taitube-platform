import type { NewSearchHistoryEntry, SearchHistoryEntry } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

interface SearchHistoryCursor {
  searchedAt: Date;
  id: string;
}

export interface ListSearchHistoryOptions {
  cursor: SearchHistoryCursor | null;
  limit: number;
}

/**
 * One row per user and `queryKey`. Recording a query again moves its row to the top and keeps the
 * user's newest `SEARCH_HISTORY_LIMIT` rows, in one statement. Every read and delete is keyed by
 * the caller's id, so another user's row is never reachable.
 */
export interface SearchHistoryRepositoryPort {
  record(entry: NewSearchHistoryEntry): Promise<Result<void, DatabaseUnavailable>>;
  /** Newest first, up to `limit + 1` rows. */
  list(
    userId: string,
    options: ListSearchHistoryOptions
  ): Promise<Result<SearchHistoryEntry[], DatabaseUnavailable>>;
  remove(userId: string, id: string): Promise<Result<boolean, DatabaseUnavailable>>;
  removeAll(userId: string): Promise<Result<void, DatabaseUnavailable>>;
  /** Housekeeping: drops every user's rows last searched before `cutoff`; answers how many. */
  purgeOlderThan(cutoff: Date): Promise<Result<number, DatabaseUnavailable>>;
}

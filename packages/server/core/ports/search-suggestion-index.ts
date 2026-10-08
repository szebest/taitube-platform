import type { CacheUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * Popular queries filed under each of their prefixes, so completing one is a single ranged read.
 * A text counts at most once per `SEARCH_SUGGESTIONS.countWindowSeconds`, so one client repeating a
 * query cannot lift it, and each prefix keeps a pool far larger than it serves, so a new query is
 * not evicted on arrival by an older one with a higher count.
 */
export interface SearchSuggestionIndexPort {
  record(text: string): Promise<Result<void, CacheUnavailable>>;
  /** The most searched queries starting with `prefix`, most searched first. */
  suggest(prefix: string, limit: number): Promise<Result<string[], CacheUnavailable>>;
}

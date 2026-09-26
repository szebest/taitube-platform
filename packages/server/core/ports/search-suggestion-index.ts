import type { CacheUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

/**
 * Popular queries filed under each of their prefixes, so completing one is a single ranged read.
 * Only a query that found something is recorded, so a suggestion always leads somewhere.
 */
export interface SearchSuggestionIndexPort {
  record(text: string): Promise<Result<void, CacheUnavailable>>;
  /** The most searched queries starting with `prefix`, most searched first. */
  suggest(prefix: string, limit: number): Promise<Result<string[], CacheUnavailable>>;
}

import type { SearchSuggestionIndexPort } from '@vp/core/ports';
import { SEARCH_SUGGESTIONS, searchSuggestionPrefixes } from '@vp/domain';
import type { CacheUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';

/** Redis orders equal scores by member, descending, under `ZREVRANGE`; so does this. */
function mostSearched([a, aScore]: [string, number], [b, bScore]: [string, number]): number {
  if (aScore !== bScore) return bScore - aScore;
  if (a === b) return 0;
  return a < b ? 1 : -1;
}

export class InMemorySearchSuggestionIndex implements SearchSuggestionIndexPort {
  private readonly prefixes = new Map<string, Map<string, number>>();

  async record(text: string): Promise<Result<void, CacheUnavailable>> {
    for (const prefix of searchSuggestionPrefixes(text)) {
      const counts = this.prefixes.get(prefix) ?? new Map<string, number>();
      counts.set(text, (counts.get(text) ?? 0) + 1);
      const kept = [...counts].sort(mostSearched).slice(0, SEARCH_SUGGESTIONS.keptPerPrefix);
      this.prefixes.set(prefix, new Map(kept));
    }
    return ok();
  }

  async suggest(prefix: string, limit: number): Promise<Result<string[], CacheUnavailable>> {
    const counts = [...(this.prefixes.get(prefix) ?? new Map<string, number>())];
    return ok(
      counts
        .sort(mostSearched)
        .slice(0, limit)
        .map(([text]) => text)
    );
  }

  clear(): void {
    this.prefixes.clear();
  }
}

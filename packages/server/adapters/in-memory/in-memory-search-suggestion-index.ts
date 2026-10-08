import type { SearchSuggestionIndexPort } from '@vp/core/ports';
import { SEARCH_SUGGESTIONS, searchSuggestionPrefixes } from '@vp/domain';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { CacheUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';

type Count = [text: string, searches: number];

/** Redis orders equal scores by member, descending, under `ZREVRANGE`; so does this. */
function mostSearched([a, aScore]: Count, [b, bScore]: Count): number {
  if (aScore !== bScore) return bScore - aScore;
  if (a === b) return 0;
  return a < b ? 1 : -1;
}

/** The member `ZRANGE key 0 0` names: the lowest score, then the lowest member. */
function leastSearched(counts: ReadonlyMap<string, number>): Count | undefined {
  return [...counts].sort(mostSearched).at(-1);
}

/** The same space-saving count as `SEARCH_SUGGESTION_SCRIPT`, over plain maps. */
export class InMemorySearchSuggestionIndex implements SearchSuggestionIndexPort {
  private readonly prefixes = new Map<string, Map<string, number>>();
  private readonly countedUntil = new Map<string, number>();

  constructor(
    private readonly now: () => number,
    private readonly keptPerPrefix: number
  ) {}

  async record(text: string): Promise<Result<void, CacheUnavailable>> {
    const now = this.now();
    for (const [counted, until] of this.countedUntil) {
      if (until <= now) this.countedUntil.delete(counted);
    }
    if (this.countedUntil.has(text)) return ok();
    this.countedUntil.set(text, now + SEARCH_SUGGESTIONS.countWindowSeconds * MS_PER_SECOND);
    for (const prefix of searchSuggestionPrefixes(text)) {
      const counts = new Map(this.prefixes.get(prefix));
      this.prefixes.set(prefix, counts);
      const searched = counts.get(text);
      if (searched !== undefined) {
        counts.set(text, searched + 1);
      } else if (counts.size < this.keptPerPrefix) {
        counts.set(text, 1);
      } else {
        const [lowest = '', lowestScore = 0] = leastSearched(counts) ?? [];
        counts.delete(lowest);
        counts.set(text, lowestScore + 1);
      }
    }
    return ok();
  }

  async suggest(prefix: string, limit: number): Promise<Result<string[], CacheUnavailable>> {
    const counts = [...(this.prefixes.get(prefix) ?? [])];
    return ok(
      counts
        .sort(mostSearched)
        .slice(0, limit)
        .map(([text]) => text)
    );
  }

  clear(): void {
    this.prefixes.clear();
    this.countedUntil.clear();
  }
}

import { createHash } from 'node:crypto';
import {
  type SearchRequest,
  type SearchResponse,
  type SearchSuggestionsResponse,
  search,
} from '@vp/api-contracts';
import type { Singleflight } from '@vp/concurrency';
import type { CacheClient, SearchSuggestionIndexPort } from '@vp/core/ports';
import type { SearchQuery, SearchRepositoryPort } from '@vp/core/repositories';
import {
  SEARCH_CACHE_TTL_SECONDS,
  SEARCH_SUGGESTIONS,
  type SearchCursor,
  type SearchMode,
  type SearchSort,
  searchHandleOf,
  searchKinds,
  searchSuggestionKey,
} from '@vp/domain';
import type { CdnBase } from '@vp/env-schema';
import { CacheKeys } from '@vp/events';
import type { Paginator } from '@vp/pagination';
import { andThen, andThenAsync, ignore, isOk, map, ok, parseJson, unwrapOr } from '@vp/result';
import { isPlainSearchQuery, validateSearchQuery } from '@vp/validation';
import { decodeSearchCursor, searchCursorPayload } from './cursor';
import { toChannelSuggestion, toSearchResultItem } from './search-views';

export interface SearchServiceDeps {
  search: SearchRepositoryPort;
  suggestions: SearchSuggestionIndexPort;
  cache: CacheClient;
  singleflight: Singleflight;
  paginator: Paginator;
  cdn: CdnBase;
  now: () => number;
}

export type CacheOutcome = 'HIT' | 'MISS';

export interface SearchResult {
  data: SearchResponse;
  cache: CacheOutcome;
}

type SearchBody = Omit<SearchResponse, 'tookMs'>;

const CachedBodySchema = search.result.omit({ tookMs: true });

interface Plan {
  text: string;
  sort: SearchSort;
  cursor: SearchCursor | null;
  key: string;
}

/**
 * The search read path: validate, look in the Redis page cache, and on a miss coalesce identical
 * concurrent searches behind one repository call. Search reads as nobody, so one cached page is
 * right for every viewer. A dead cache costs latency and never correctness, so `CacheUnavailable`
 * is absent from both return types.
 */
export class SearchService {
  constructor(private readonly deps: SearchServiceDeps) {}

  async search(request: SearchRequest) {
    const startedAt = this.deps.now();
    return andThenAsync(this.plan(request), async (plan) => {
      const cached = await this.readCache(plan.key);
      if (cached) return ok(this.timed(cached, 'HIT', startedAt));

      const computed = await this.deps.singleflight.do(plan.key, async () => {
        const body = await this.compute(request, plan);
        if (isOk(body)) await this.remember(plan, body.value);
        return body;
      });
      return map(computed, (body) => this.timed(body, 'MISS', startedAt));
    });
  }

  async suggest(q: string) {
    const { limit, channelHits } = SEARCH_SUGGESTIONS;
    return andThenAsync(validateSearchQuery(q), async (text) => {
      const channels = await this.deps.search.suggestChannels(searchHandleOf(text), channelHits);
      const popular = unwrapOr(
        await this.deps.suggestions.suggest(searchSuggestionKey(text), limit),
        []
      );
      return map(
        channels,
        (found): SearchSuggestionsResponse => ({
          items: [
            ...found.map(toChannelSuggestion),
            ...popular
              .filter((query) => query.startsWith(text))
              .map((query) => ({ type: 'query' as const, text: query })),
          ].slice(0, limit),
        })
      );
    });
  }

  private plan(request: SearchRequest) {
    const { sort } = request;
    return andThen(validateSearchQuery(request.q), (text) =>
      map(
        decodeSearchCursor(request.cursor, sort, this.deps.paginator),
        (cursor): Plan => ({ text, sort, cursor, key: this.cacheKey(request, text) })
      )
    );
  }

  private async compute(request: SearchRequest, { text, sort, cursor }: Plan) {
    const instant = cursor?.instant ?? this.deps.now();
    const limit = this.deps.paginator.limit(request.limit);
    const query = (mode: SearchMode): SearchQuery => ({
      text,
      kinds: searchKinds(request.type),
      sort,
      mode,
      instant,
      categoryId: request.categoryId ?? null,
      cursor,
      limit,
    });

    const firstMode = cursor?.mode ?? 'lexical';
    const first = await this.deps.search.search(query(firstMode));
    const fallBack = !cursor && isOk(first) && first.value.total === 0;
    const mode: SearchMode = fallBack ? 'fuzzy' : firstMode;
    const found = fallBack ? await this.deps.search.search(query(mode)) : first;

    return map(
      found,
      (page): SearchBody => ({
        ...this.deps.paginator.paginate(page.hits, limit, {
          cursorOf: (hit) => searchCursorPayload(hit, { sort, mode, instant }),
          toItem: (hit) => toSearchResultItem(hit, this.deps.cdn),
        }),
        total: page.total,
        fuzzyFallback: mode === 'fuzzy',
      })
    );
  }

  private timed(body: SearchBody, cache: CacheOutcome, startedAt: number): SearchResult {
    return { data: { ...body, tookMs: this.deps.now() - startedAt }, cache };
  }

  private cacheKey(request: SearchRequest, text: string): string {
    const { sort, categoryId, cursor, limit } = request;
    const hash = createHash('sha256')
      .update(JSON.stringify([text, sort, categoryId ?? null, cursor ?? null, limit]))
      .digest('hex');
    return CacheKeys.searchQuery(request.type, hash);
  }

  private async readCache(key: string): Promise<SearchBody | null> {
    const raw = unwrapOr(await this.deps.cache.get(key), null);
    if (raw === null) return null;
    const parsed = parseJson(raw);
    if (!isOk(parsed)) return null;
    const body = CachedBodySchema.safeParse(parsed.value);
    return body.success ? body.data : null;
  }

  private async remember({ text, cursor, key }: Plan, body: SearchBody): Promise<void> {
    ignore(
      await this.deps.cache.set(key, JSON.stringify(body), SEARCH_CACHE_TTL_SECONDS),
      'a missed write costs the next searcher one query'
    );
    if (cursor || body.total === 0 || body.fuzzyFallback || !isPlainSearchQuery(text)) return;
    ignore(
      await this.deps.suggestions.record(text),
      'a query the index missed is suggested a little less often'
    );
  }
}

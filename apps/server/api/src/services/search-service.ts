import { createHash } from 'node:crypto';
import {
  type SearchRequest,
  type SearchResponse,
  type SearchSuggestionsResponse,
  search,
} from '@vp/api-contracts';
import type { Singleflight } from '@vp/concurrency';
import type { CacheClient, SearchSuggestionIndexPort } from '@vp/core/ports';
import type {
  ChannelRepositoryPort,
  SearchHistoryRepositoryPort,
  SearchQuery,
  SearchRepositoryPort,
} from '@vp/core/repositories';
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
import { decideSearchHistoryRecord } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import { CacheKeys } from '@vp/events';
import type { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import {
  andThen,
  andThenAsync,
  err,
  ignore,
  isErr,
  isOk,
  map,
  ok,
  parseJson,
  unwrapOr,
} from '@vp/result';
import { isPlainSearchQuery, searchQueryWithoutTerms, validateSearchQuery } from '@vp/validation';
import { uuidv7 } from 'uuidv7';
import { decodeSearchCursor, searchCursorPayload } from './cursor';
import type { HistoryPause } from './history-pause';
import { toChannelSuggestion, toSearchResultItem } from './search-views';
import { type SpriteGeometry, loadChannelsOf } from './video-views';
import type { ViewerProgress } from './viewer-progress';

export interface SearchServiceDeps {
  search: SearchRepositoryPort;
  suggestions: SearchSuggestionIndexPort;
  cache: CacheClient;
  singleflight: Singleflight;
  paginator: Paginator;
  viewerProgress: ViewerProgress;
  history: SearchHistoryRepositoryPort;
  pause: HistoryPause;
  cdn: CdnBase;
  sprite: SpriteGeometry;
  channels: ChannelRepositoryPort;
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

  async search(request: SearchRequest, viewer: UserContext | null = null) {
    const startedAt = this.deps.now();
    return andThenAsync(this.plan(request), async (plan) => {
      await this.recordHistory(plan, viewer);
      const cached = await this.readCache(plan.key);
      if (cached) return ok(await this.timed(cached, 'HIT', startedAt, viewer));

      const computed = await this.deps.singleflight.do(plan.key, () =>
        this.searchUncached(request, plan)
      );
      if (isErr(computed)) return computed;
      return ok(await this.timed(computed.value, 'MISS', startedAt, viewer));
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

  private async recordHistory({ text, cursor }: Plan, viewer: UserContext | null): Promise<void> {
    if (cursor) return;
    const entry = decideSearchHistoryRecord({
      viewer,
      text,
      id: uuidv7(),
      now: new Date(this.deps.now()),
    });
    const recorded = await andThenAsync(entry, async (row) =>
      andThenAsync(this.deps.pause.isPaused(row.userId), (paused) =>
        paused ? ok() : this.deps.history.record(row)
      )
    );
    ignore(recorded, 'a guest has no trail, and search never fails because of its history');
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

  private async searchUncached(request: SearchRequest, plan: Plan) {
    const narrowing = andThen(await this.deps.search.restricts(plan.text), (narrows) =>
      narrows ? ok(plan) : err(searchQueryWithoutTerms())
    );
    return andThenAsync(narrowing, async (narrowed) => {
      const body = await this.compute(request, narrowed);
      if (isOk(body)) await this.remember(narrowed, body.value);
      return body;
    });
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

    return andThenAsync(found, async (page) => {
      const owners = page.hits.flatMap((hit) => (hit.kind === 'video' ? [hit.video.ownerId] : []));
      const channelOf = await loadChannelsOf(this.deps.channels, owners);
      return map(
        channelOf,
        (of): SearchBody => ({
          ...this.deps.paginator.paginate(page.hits, limit, {
            cursorOf: (hit) => searchCursorPayload(hit, { sort, mode, instant }),
            toItem: (hit) => toSearchResultItem(hit, this.deps.cdn, this.deps.sprite, of),
          }),
          total: page.total,
          fuzzyFallback: mode === 'fuzzy',
        })
      );
    });
  }

  private async timed(
    body: SearchBody,
    cache: CacheOutcome,
    startedAt: number,
    viewer: UserContext | null
  ): Promise<SearchResult> {
    const items = await this.withProgress(body.items, viewer);
    return { data: { ...body, items, tookMs: this.deps.now() - startedAt }, cache };
  }

  private async withProgress(
    items: SearchBody['items'],
    viewer: UserContext | null
  ): Promise<SearchBody['items']> {
    const videos = items.flatMap((item) => (item.type === 'video' ? [item.data] : []));
    const marked = new Map(
      (await this.deps.viewerProgress.attach(viewer, videos)).map((video) => [video.id, video])
    );
    return items.map((item) =>
      item.type === 'video' ? { ...item, data: marked.get(item.data.id) ?? item.data } : item
    );
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

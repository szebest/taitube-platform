import { createHash } from 'node:crypto';
import type { InvalidCursor, Paginator } from '@kit/pagination';
import {
  andThen,
  andThenAsync,
  err,
  ignore,
  isErr,
  isOk,
  ok,
  parseJson,
  unwrapOr,
  type Result,
} from '@kit/result';
import {
  type ListWatchPartiesQuery,
  type WatchPartyCardView,
  listWatchParties,
} from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import type { DiscoverableRoom } from '@vp/core/repositories';
import {
  type SearchMode,
  type WatchPartyDiscoveryFilters,
  watchPartyDiscoveryPosition,
} from '@vp/domain';
import type { CacheUnavailable, DatabaseUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import type { UserContext } from '@vp/permissions';
import { type InvalidField, searchQueryWithoutTerms, validateSearchQuery } from '@vp/validation';
import { type CardDeps, presentCards } from './watch-party-card-views';
import {
  type DiscoveryWalk,
  decodeDiscoveryCursor,
  discoveryCursorPayload,
} from './watch-party-discovery-cursor';

export interface WatchPartyDiscoveryDeps extends CardDeps {
  readonly cache: Pick<CacheClient, 'get' | 'set'>;
  readonly paginator: Paginator;
}

export interface WatchPartyDiscoveryPage {
  readonly items: WatchPartyCardView[];
  readonly nextCursor: string | null;
}

export type DiscoveryFailure =
  | InvalidField
  | InvalidCursor
  | DatabaseUnavailable
  | CacheUnavailable;

const CachedPageSchema = listWatchParties.result;

interface Plan {
  readonly filters: WatchPartyDiscoveryFilters;
  readonly sort: ListWatchPartiesQuery['sort'];
  readonly limit: number;
  readonly walk: DiscoveryWalk | null;
}

/**
 * The discovery read path: validate the text and the cursor, ask for a keyset page, and fall back
 * to the trigram match when the first page of a text search finds nothing. A signed-out first page
 * is kept for a few seconds; a dead cache costs a query and never a wrong answer.
 */
export class WatchPartyDiscoveryService {
  constructor(private readonly deps: WatchPartyDiscoveryDeps) {}

  async list(
    viewer: UserContext | null,
    request: ListWatchPartiesQuery
  ): Promise<Result<WatchPartyDiscoveryPage, DiscoveryFailure>> {
    const planned = await this.plan(viewer, request);
    if (isErr(planned)) return planned;
    const plan = planned.value;

    const cacheKey = viewer === null && plan.walk === null ? this.cacheKey(plan) : null;
    if (cacheKey !== null) {
      const cached = await this.readCache(cacheKey);
      if (cached) return ok(cached);
    }
    const page = await this.page(viewer, plan);
    if (cacheKey !== null && isOk(page)) await this.remember(cacheKey, page.value);
    return page;
  }

  private async plan(
    viewer: UserContext | null,
    request: ListWatchPartiesQuery
  ): Promise<Result<Plan, InvalidField | InvalidCursor | DatabaseUnavailable>> {
    const { paginator } = this.deps;
    const text = await this.textOf(request.q);
    if (isErr(text)) return text;
    const walk = decodeDiscoveryCursor(request.cursor, request.sort, paginator);
    if (isErr(walk)) return walk;

    const { sort } = request;
    return ok({
      filters: {
        text: text.value,
        status: sort === 'starting_soon' ? 'scheduled' : request.status,
        categoryId: request.category ?? null,
        language: request.language ?? null,
        access: request.access,
        size: request.size,
        space: request.space,
        followed: request.followed && viewer !== null,
        creator: request.creator,
        kind: request.kind,
      },
      sort,
      limit: paginator.limit(request.limit),
      walk: walk.value,
    });
  }

  private async textOf(
    q: string | undefined
  ): Promise<Result<string | null, InvalidField | DatabaseUnavailable>> {
    if (q === undefined || q.trim() === '') return ok(null);
    const text = validateSearchQuery(q);
    if (isErr(text)) return text;
    return andThen(await this.deps.repositories.search.restricts(text.value), (restricts) =>
      restricts ? ok(text.value) : err(searchQueryWithoutTerms())
    );
  }

  private async page(
    viewer: UserContext | null,
    plan: Plan
  ): Promise<Result<WatchPartyDiscoveryPage, DatabaseUnavailable | CacheUnavailable>> {
    const first = await this.rows(viewer, plan, plan.walk?.mode ?? 'lexical');
    if (isErr(first)) return first;
    const fallBack = plan.walk === null && plan.filters.text !== null && first.value.length === 0;
    const mode: SearchMode = fallBack ? 'fuzzy' : (plan.walk?.mode ?? 'lexical');
    const found = fallBack ? await this.rows(viewer, plan, mode) : first;

    return andThenAsync(found, async (rows) => {
      const { paginator } = this.deps;
      const page = paginator.paginate(rows, plan.limit, {
        cursorOf: (row) =>
          discoveryCursorPayload(watchPartyDiscoveryPosition(plan.sort, row), mode),
        toItem: (row) => row,
      });
      const cards = await presentCards(this.deps, page.items);
      return andThen(cards, (items) => ok({ items, nextCursor: page.nextCursor }));
    });
  }

  private rows(
    viewer: UserContext | null,
    plan: Plan,
    mode: SearchMode
  ): Promise<Result<DiscoverableRoom[], DatabaseUnavailable>> {
    const { repositories, config, now } = this.deps;
    return repositories.watchPartyRooms.listDiscoverable({
      filters: plan.filters,
      sort: plan.sort,
      mode,
      viewerId: viewer?.id ?? null,
      ceiling: config.maxMembers,
      now: now(),
      after: plan.walk?.position ?? null,
      limit: plan.limit,
    });
  }

  private cacheKey({ filters, sort, limit }: Plan): string {
    const hash = createHash('sha256')
      .update(JSON.stringify([filters, sort, limit]))
      .digest('hex');
    return CacheKeys.watchPartyDiscovery(hash);
  }

  private async readCache(key: string): Promise<WatchPartyDiscoveryPage | null> {
    const raw = unwrapOr(await this.deps.cache.get(key), null);
    if (raw === null) return null;
    const parsed = parseJson(raw);
    if (!isOk(parsed)) return null;
    const page = CachedPageSchema.safeParse(parsed.value);
    return page.success ? page.data : null;
  }

  private async remember(key: string, page: WatchPartyDiscoveryPage): Promise<void> {
    ignore(
      await this.deps.cache.set(
        key,
        JSON.stringify(page),
        this.deps.config.discovery.firstPageCacheSeconds
      ),
      'a missed write costs the next signed-out caller one query'
    );
  }
}

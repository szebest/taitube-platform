import { Singleflight } from '@vp/adapters';
import type { FeedQuery, FeedResponse } from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import { type Result, isOk, map, ok, tryCatch, unwrapOr } from '@vp/result';
import { HttpCacheService } from './http-cache-service';
import type { ListVideosFailure, VideoService } from './video-service';

const FEED_MAX_AGE_SECONDS = 30;
const FEED_STALE_WHILE_REVALIDATE_SECONDS = 60;

export interface FeedServiceDeps {
  videoService: VideoService;
  cache?: CacheClient;
  httpCacheService?: HttpCacheService;
  maxAgeSeconds?: number;
  staleWhileRevalidateSeconds?: number;
}

export interface FeedPage {
  data: FeedResponse;
  etag: string;
  headers: Record<string, string>;
  notModified: boolean;
}

interface CachedFeedPage {
  data: FeedResponse;
  etag: string;
}

/**
 * FeedService — the public feed read path: Redis page cache for the first page,
 * singleflight coalescing behind it, and conditional-request evaluation.
 */
export class FeedService {
  private readonly videoService: VideoService;
  private readonly cache?: CacheClient;
  private readonly httpCache: HttpCacheService;
  private readonly maxAgeSeconds: number;
  private readonly staleWhileRevalidateSeconds: number;
  private readonly singleflight = new Singleflight();

  constructor(deps: FeedServiceDeps) {
    this.videoService = deps.videoService;
    this.cache = deps.cache;
    this.httpCache = deps.httpCacheService ?? new HttpCacheService();
    this.maxAgeSeconds = deps.maxAgeSeconds ?? FEED_MAX_AGE_SECONDS;
    this.staleWhileRevalidateSeconds =
      deps.staleWhileRevalidateSeconds ?? FEED_STALE_WHILE_REVALIDATE_SECONDS;
  }

  /**
   * `CacheUnavailable` is absent from the return type on purpose: a cold or dead page cache falls
   * through to the repository, so it costs latency and never correctness. Only the repository's
   * own failure reaches the caller.
   */
  async getFeed(
    query: FeedQuery,
    ifNoneMatch?: string
  ): Promise<Result<FeedPage, ListVideosFailure>> {
    const sort = query.sort ?? 'recent';
    const limit = query.limit ?? undefined;
    const variant = `${sort}:${query.categoryId || 'all'}`;

    const cached = query.cursor ? undefined : await this.readCache(variant);
    if (cached) {
      return ok(this.page(cached, ifNoneMatch));
    }

    const listed = await this.singleflight.do(
      `feed:${variant}:${query.cursor || 'first'}:${limit ?? 'default'}`,
      () =>
        this.videoService.listPublic({
          sort,
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          ...(query.cursor ? { cursor: query.cursor } : {}),
          ...(limit === undefined ? {} : { limit }),
        })
    );

    return await this.pageOf(listed, variant, Boolean(query.cursor), ifNoneMatch);
  }

  /** Only a page that was actually read is cached; a failure is never written under the key. */
  private async pageOf(
    listed: Result<FeedResponse, ListVideosFailure>,
    variant: string,
    hasCursor: boolean,
    ifNoneMatch?: string
  ): Promise<Result<FeedPage, ListVideosFailure>> {
    if (!listed.ok) return listed;

    const fresh: CachedFeedPage = {
      data: listed.value,
      etag: this.httpCache.generateEtag(listed.value),
    };
    if (!hasCursor) {
      await this.writeCache(variant, fresh);
    }

    return map(listed, () => this.page(fresh, ifNoneMatch));
  }

  private page(cached: CachedFeedPage, ifNoneMatch?: string): FeedPage {
    return {
      ...cached,
      notModified: this.httpCache.isNotModified(ifNoneMatch, cached.etag),
      headers: this.httpCache.buildCacheHeaders({
        etag: cached.etag,
        maxAgeSeconds: this.maxAgeSeconds,
        staleWhileRevalidateSeconds: this.staleWhileRevalidateSeconds,
      }),
    };
  }

  private cacheKey(variant: string): string {
    return `taitube:feed:public:${variant}`;
  }

  private async readCache(variant: string): Promise<CachedFeedPage | undefined> {
    if (!this.cache) return undefined;

    const raw = unwrapOr(await this.cache.get(this.cacheKey(variant)), null);
    if (!raw) return undefined;

    const parsed = tryCatch(
      () => JSON.parse(raw) as CachedFeedPage,
      () => null
    );
    return isOk(parsed) ? parsed.value : undefined;
  }

  /** A cold page cache costs latency, never correctness, so the write's failure is dropped here. */
  private async writeCache(variant: string, page: CachedFeedPage): Promise<void> {
    await this.cache?.set(this.cacheKey(variant), JSON.stringify(page), this.maxAgeSeconds);
  }
}

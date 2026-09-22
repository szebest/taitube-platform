import { Singleflight } from '@vp/adapters';
import type { FeedQuery, FeedResponse } from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import { HttpCacheService } from './http-cache-service';
import type { VideoService } from './video-service';

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

  async getFeed(query: FeedQuery, ifNoneMatch?: string): Promise<FeedPage> {
    const sort = query.sort ?? 'recent';
    const limit = query.limit ?? undefined;
    const variant = `${sort}:${query.categoryId || 'all'}`;

    const cached = query.cursor ? undefined : await this.readCache(variant);
    if (cached) {
      return this.page(cached, ifNoneMatch);
    }

    const data = await this.singleflight.do(
      `feed:${variant}:${query.cursor || 'first'}:${limit ?? 'default'}`,
      () =>
        this.videoService.listPublic({
          sort,
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          ...(query.cursor ? { cursor: query.cursor } : {}),
          ...(limit === undefined ? {} : { limit }),
        })
    );

    const fresh: CachedFeedPage = { data, etag: this.httpCache.generateEtag(data) };
    if (!query.cursor) {
      await this.writeCache(variant, fresh);
    }

    return this.page(fresh, ifNoneMatch);
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
    try {
      const raw = await this.cache.get(this.cacheKey(variant));
      return raw ? (JSON.parse(raw) as CachedFeedPage) : undefined;
    } catch {
      return undefined;
    }
  }

  private async writeCache(variant: string, page: CachedFeedPage): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.set(this.cacheKey(variant), JSON.stringify(page), this.maxAgeSeconds);
    } catch {
      // A cold page cache costs latency, never correctness.
    }
  }
}

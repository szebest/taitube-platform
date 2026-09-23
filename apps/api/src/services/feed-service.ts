import type { FeedQuery, FeedResponse } from '@vp/api-contracts';
import type { Singleflight } from '@vp/concurrency';
import type { CacheClient } from '@vp/core/ports';
import { type Result, ignore, isOk, map, ok, parseJson, unwrapOr } from '@vp/result';
import { buildCacheHeaders, generateEtag, isNotModified } from './http-cache';
import type { ListVideosFailure, VideoService } from './video-service';

export interface FeedServiceDeps {
  videoService: VideoService;
  cache: CacheClient;
  singleflight: Singleflight;
  maxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
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
 * The public feed read path: Redis page cache for the first page,
 * singleflight coalescing behind it, and conditional-request evaluation.
 */
export class FeedService {
  private readonly videoService: VideoService;
  private readonly cache: CacheClient;
  private readonly maxAgeSeconds: number;
  private readonly staleWhileRevalidateSeconds: number;
  private readonly singleflight: Singleflight;

  constructor(deps: FeedServiceDeps) {
    this.videoService = deps.videoService;
    this.cache = deps.cache;
    this.singleflight = deps.singleflight;
    this.maxAgeSeconds = deps.maxAgeSeconds;
    this.staleWhileRevalidateSeconds = deps.staleWhileRevalidateSeconds;
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
          categoryId: query.categoryId || undefined,
          cursor: query.cursor || undefined,
          limit,
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
      etag: generateEtag(listed.value),
    };
    if (!hasCursor) {
      await this.writeCache(variant, fresh);
    }

    return map(listed, () => this.page(fresh, ifNoneMatch));
  }

  private page(cached: CachedFeedPage, ifNoneMatch?: string): FeedPage {
    return {
      ...cached,
      notModified: isNotModified(ifNoneMatch, cached.etag),
      headers: buildCacheHeaders({
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
    const raw = unwrapOr(await this.cache.get(this.cacheKey(variant)), null);
    if (!raw) return undefined;

    const parsed = parseJson(raw);
    return isOk(parsed) ? (parsed.value as CachedFeedPage) : undefined;
  }

  private async writeCache(variant: string, page: CachedFeedPage): Promise<void> {
    ignore(
      await this.cache.set(this.cacheKey(variant), JSON.stringify(page), this.maxAgeSeconds),
      'a cold page cache costs latency, never correctness'
    );
  }
}

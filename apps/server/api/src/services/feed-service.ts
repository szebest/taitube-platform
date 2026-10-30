import {
  type FeedQuery,
  type FeedResponse,
  type ShortsQuery,
  VideoSummarySchema,
  getFeed,
} from '@vp/api-contracts';
import type { VideoFormat } from '@vp/domain';
import type { Singleflight } from '@vp/concurrency';
import type { CacheClient } from '@vp/core/ports';
import { CacheKeys } from '@vp/events';
import type { UserContext } from '@vp/permissions';
import { type Result, ignore, isErr, isOk, ok, parseJson, unwrapOr } from '@vp/result';
import { z } from 'zod';
import type { FeedSort } from './cursor';
import { buildCacheHeaders, generateEtag, isNotModified } from './http-cache';
import type { ListVideosFailure, VideoService } from './video-service';
import type { ViewerProgress } from './viewer-progress';

export interface FeedServiceDeps {
  videoService: VideoService;
  viewerProgress: ViewerProgress;
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

interface FeedRead {
  sort: FeedSort;
  format: VideoFormat;
  categoryId?: string;
  cursor?: string;
  limit?: number;
}

const CachedCardsSchema = getFeed.result.extend({
  items: z.array(VideoSummarySchema.omit({ channel: true })),
});

type CachedCards = z.infer<typeof CachedCardsSchema>;

/**
 * The public feed read path: Redis page cache for the first page, singleflight coalescing behind
 * it, and conditional-request evaluation. The cache holds the cards without their channels, which
 * are read on every request, so a renamed channel or a new avatar shows before the page expires.
 */
export class FeedService {
  private readonly videoService: VideoService;
  private readonly viewerProgress: ViewerProgress;
  private readonly cache: CacheClient;
  private readonly maxAgeSeconds: number;
  private readonly staleWhileRevalidateSeconds: number;
  private readonly singleflight: Singleflight;

  constructor(deps: FeedServiceDeps) {
    this.videoService = deps.videoService;
    this.viewerProgress = deps.viewerProgress;
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
    ifNoneMatch?: string,
    viewer: UserContext | null = null
  ): Promise<Result<FeedPage, ListVideosFailure>> {
    return this.read(
      {
        sort: query.sort ?? 'recent',
        format: query.format ?? 'standard',
        categoryId: query.categoryId || undefined,
        cursor: query.cursor || undefined,
        limit: query.limit ?? undefined,
      },
      ifNoneMatch,
      viewer
    );
  }

  /** The cursor of each page carries the Shorts already served, so a walk never repeats one. */
  async getShorts(
    query: ShortsQuery,
    ifNoneMatch?: string,
    viewer: UserContext | null = null
  ): Promise<Result<FeedPage, ListVideosFailure>> {
    return this.read(
      { sort: 'shorts', format: 'short', cursor: query.cursor || undefined, limit: query.limit },
      ifNoneMatch,
      viewer
    );
  }

  private async read(
    query: FeedRead,
    ifNoneMatch: string | undefined,
    viewer: UserContext | null
  ): Promise<Result<FeedPage, ListVideosFailure>> {
    const cards = await this.cardsOf(query);
    if (isErr(cards)) return cards;

    const items = await this.videoService.withChannels(cards.value.items);
    if (isErr(items)) return items;

    const withProgress = await this.viewerProgress.attach(viewer, items.value);
    return ok(this.page({ ...cards.value, items: withProgress }, ifNoneMatch, viewer !== null));
  }

  private async cardsOf(query: FeedRead): Promise<Result<CachedCards, ListVideosFailure>> {
    const { sort, format, limit } = query;
    const variant = `${sort}:${format}:${query.categoryId || 'all'}`;

    const cached = query.cursor ? undefined : await this.readCache(variant);
    if (cached) return ok(cached);

    const listed = await this.singleflight.do(
      `feed:${variant}:${query.cursor || 'first'}:${limit ?? 'default'}`,
      () =>
        this.videoService.listPublic({
          sort,
          format,
          categoryId: query.categoryId,
          cursor: query.cursor,
          limit,
        })
    );

    if (isOk(listed) && !query.cursor) {
      await this.writeCache(variant, listed.value);
    }
    return listed;
  }

  private page(data: FeedResponse, ifNoneMatch: string | undefined, personal: boolean): FeedPage {
    const etag = generateEtag(data);
    return {
      data,
      etag,
      notModified: isNotModified(ifNoneMatch, etag),
      headers: {
        ...buildCacheHeaders({
          etag,
          isPublic: !personal,
          maxAgeSeconds: this.maxAgeSeconds,
          staleWhileRevalidateSeconds: this.staleWhileRevalidateSeconds,
        }),
        Vary: 'Authorization',
      },
    };
  }

  private async readCache(variant: string): Promise<CachedCards | undefined> {
    const raw = unwrapOr(await this.cache.get(CacheKeys.publicFeed(variant)), null);
    if (!raw) return undefined;

    const parsed = parseJson(raw);
    if (!isOk(parsed)) return undefined;

    const cards = CachedCardsSchema.safeParse(parsed.value);
    return cards.success ? cards.data : undefined;
  }

  private async writeCache(variant: string, cards: CachedCards): Promise<void> {
    ignore(
      await this.cache.set(
        CacheKeys.publicFeed(variant),
        JSON.stringify(cards),
        this.maxAgeSeconds
      ),
      'a cold page cache costs latency, never correctness'
    );
  }
}

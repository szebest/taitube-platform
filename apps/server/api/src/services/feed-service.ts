import type { Singleflight } from '@kit/concurrency';
import type { CacheClient } from '@kit/ports';
import { type Result, ignore, isErr, isOk, ok, parseJson, unwrapOr } from '@kit/result';
import {
  type FeedQuery,
  type FeedResponse,
  type ShortsQuery,
  VIEWER_SESSION_HEADER,
  VideoSummarySchema,
  getFeed,
} from '@vp/api-contracts';
import type { VideoFormat } from '@vp/domain';
import { CacheKeys } from '@vp/events';
import type { UserContext } from '@vp/permissions';
import { z } from 'zod';
import type { FeedSort } from './cursor';
import type { ExperimentOverlay } from './experiment-overlay';
import { buildCacheHeaders, generateEtag, isNotModified } from './http-cache';
import type { ListVideosFailure, VideoService } from './video-service';
import type { ViewerProgress } from './viewer-progress';

export interface FeedServiceDeps {
  videoService: VideoService;
  viewerProgress: ViewerProgress;
  experiments: ExperimentOverlay;
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

/** Who asks for a page: the caller's progress and test variants make it theirs alone. */
export interface FeedReader {
  ifNoneMatch?: string;
  viewer?: UserContext | null;
  sessionKey?: string | null;
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
  constructor(private readonly deps: FeedServiceDeps) {}

  /**
   * `CacheUnavailable` is absent from the return type on purpose: a cold or dead page cache falls
   * through to the repository, so it costs latency and never correctness. Only the repository's
   * own failure reaches the caller.
   */
  async getFeed(
    query: FeedQuery,
    reader: FeedReader = {}
  ): Promise<Result<FeedPage, ListVideosFailure>> {
    return this.read(
      {
        sort: query.sort ?? 'recent',
        format: query.format ?? 'standard',
        categoryId: query.categoryId || undefined,
        cursor: query.cursor || undefined,
        limit: query.limit ?? undefined,
      },
      reader
    );
  }

  /** The cursor of each page carries the Shorts already served, so a walk never repeats one. */
  async getShorts(
    query: ShortsQuery,
    reader: FeedReader = {}
  ): Promise<Result<FeedPage, ListVideosFailure>> {
    return this.read(
      { sort: 'shorts', format: 'short', cursor: query.cursor || undefined, limit: query.limit },
      reader
    );
  }

  private async read(
    query: FeedRead,
    { ifNoneMatch, viewer = null, sessionKey = null }: FeedReader
  ): Promise<Result<FeedPage, ListVideosFailure>> {
    const cards = await this.cardsOf(query);
    if (isErr(cards)) return cards;

    const items = await this.deps.videoService.withChannels(cards.value.items);
    if (isErr(items)) return items;

    const withProgress = await this.deps.viewerProgress.attach(viewer, items.value);
    const shown = await this.deps.experiments.apply(withProgress, sessionKey);
    const personal = viewer !== null || shown.some((item) => item.experiment !== undefined);
    return ok(this.page({ ...cards.value, items: shown }, ifNoneMatch, personal));
  }

  private async cardsOf(query: FeedRead): Promise<Result<CachedCards, ListVideosFailure>> {
    const { sort, format, limit } = query;
    const variant = `${sort}:${format}:${query.categoryId || 'all'}`;

    const cached = query.cursor ? undefined : await this.readCache(variant);
    if (cached) return ok(cached);

    const listed = await this.deps.singleflight.do(
      `feed:${variant}:${query.cursor || 'first'}:${limit ?? 'default'}`,
      () =>
        this.deps.videoService.listPublic({
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
          maxAgeSeconds: this.deps.maxAgeSeconds,
          staleWhileRevalidateSeconds: this.deps.staleWhileRevalidateSeconds,
        }),
        Vary: `Authorization, ${VIEWER_SESSION_HEADER}`,
      },
    };
  }

  private async readCache(variant: string): Promise<CachedCards | undefined> {
    const raw = unwrapOr(await this.deps.cache.get(CacheKeys.publicFeed(variant)), null);
    if (!raw) return undefined;

    const parsed = parseJson(raw);
    if (!isOk(parsed)) return undefined;

    const cards = CachedCardsSchema.safeParse(parsed.value);
    return cards.success ? cards.data : undefined;
  }

  private async writeCache(variant: string, cards: CachedCards): Promise<void> {
    ignore(
      await this.deps.cache.set(
        CacheKeys.publicFeed(variant),
        JSON.stringify(cards),
        this.deps.maxAgeSeconds
      ),
      'a cold page cache costs latency, never correctness'
    );
  }
}

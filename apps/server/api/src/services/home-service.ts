import { type HomeResponse, type HomeShelf, type ReasonedVideo, getHome } from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import type {
  CategoryRepositoryPort,
  SubscriptionRepositoryPort,
  VideoRecord,
  WatchHistoryRepositoryPort,
} from '@vp/core/repositories';
import {
  HOME_SHELVES,
  type WatchHistoryEntry,
  isContinuable,
  isStrongWatch,
  topCategoryIds,
} from '@vp/domain';
import { CacheKeys } from '@vp/events';
import type { UserContext } from '@vp/permissions';
import { type Result, ignore, isErr, isOk, ok, parseJson, unwrapOr } from '@vp/result';
import type { RelatedService } from './related-service';
import type { ListVideosFailure, VideoService } from './video-service';
import type { VideoCardView, VideoSummaryView } from './video-views';
import type { ViewerProgress } from './viewer-progress';

export interface HomeServiceDeps {
  videoService: VideoService;
  related: RelatedService;
  history: WatchHistoryRepositoryPort;
  subscriptions: SubscriptionRepositoryPort;
  categories: CategoryRepositoryPort;
  viewerProgress: ViewerProgress;
  cache: CacheClient;
}

type Reason = ReasonedVideo['reason'];
type ShelfFailure = ListVideosFailure;

function reasoned(
  items: readonly VideoSummaryView[],
  reason: (item: VideoSummaryView) => Reason
): ReasonedVideo[] {
  return items.slice(0, HOME_SHELVES.shelfSize).map((item) => ({ ...item, reason: reason(item) }));
}

/**
 * Deterministic shelves over data the platform already holds, each item carrying the reason it was
 * picked. A page is cached per viewer, and a new watch or subscription drops that viewer's page.
 * A dead cache costs latency, never correctness, so `CacheUnavailable` is absent from the types.
 */
export class HomeService {
  constructor(private readonly deps: HomeServiceDeps) {}

  async get(viewer: UserContext | null): Promise<Result<HomeResponse, ShelfFailure>> {
    const key = CacheKeys.home(viewer?.id ?? 'anonymous');
    const cached = await this.readCache(key);
    if (cached) return ok(cached);

    const built = await this.build(viewer);
    if (isOk(built)) {
      ignore(
        await this.deps.cache.set(key, JSON.stringify(built.value), HOME_SHELVES.cacheTtlSeconds),
        'a missed write costs the next visit one build'
      );
    }
    return built;
  }

  async forget(userId: string): Promise<void> {
    ignore(await this.deps.cache.del(CacheKeys.home(userId)), 'the page expires with its TTL');
  }

  private async build(viewer: UserContext | null): Promise<Result<HomeResponse, ShelfFailure>> {
    const history = viewer
      ? await this.deps.history.list(viewer, { cursor: null, limit: HOME_SHELVES.historyWindow })
      : ok<WatchHistoryEntry[]>([]);
    if (isErr(history)) return history;

    const trending = await this.deps.videoService.listPublic({
      sort: 'trending',
      limit: HOME_SHELVES.shelfSize,
    });
    if (isErr(trending)) return trending;

    const shelves: Array<Result<HomeShelf[], ShelfFailure>> = [
      await this.continueShelf(history.value),
      await this.subscriptionsShelf(viewer),
      await this.becauseWatchedShelves(viewer, history.value),
      await this.categoryShelves(
        [...history.value.map((entry) => entry.video), ...trending.value.items],
        trending.value.items
      ),
      await this.trendingShelf(trending.value.items),
    ];

    const built: HomeShelf[] = [];
    for (const shelf of shelves) {
      if (isErr(shelf)) return shelf;
      built.push(...shelf.value.filter((candidate) => candidate.items.length > 0));
    }
    return ok({ shelves: await this.withProgress(viewer, built) });
  }

  private async continueShelf(
    history: readonly WatchHistoryEntry[]
  ): Promise<Result<HomeShelf[], ShelfFailure>> {
    const summaries = await this.deps.videoService.summarize(
      history.filter(isContinuable).map((entry) => entry.video)
    );
    if (isErr(summaries)) return summaries;

    return ok([
      { kind: 'continue', items: reasoned(summaries.value, () => ({ kind: 'continue' })) },
    ]);
  }

  private async subscriptionsShelf(
    viewer: UserContext | null
  ): Promise<Result<HomeShelf[], ShelfFailure>> {
    if (!viewer) return ok([]);

    const feed = await this.deps.subscriptions.getSubscriptionFeed(viewer.id, {
      limit: HOME_SHELVES.shelfSize,
    });
    if (isErr(feed)) return feed;

    const summaries = await this.deps.videoService.summarize(feed.value.items);
    if (isErr(summaries)) return summaries;

    return ok([
      {
        kind: 'subscriptions',
        items: reasoned(summaries.value, ({ channel }) => ({
          kind: 'subscription',
          subjectId: channel?.id,
        })),
      },
    ]);
  }

  private async becauseWatchedShelves(
    viewer: UserContext | null,
    history: readonly WatchHistoryEntry[]
  ): Promise<Result<HomeShelf[], ShelfFailure>> {
    const watched = new Set(history.map((entry) => entry.videoId));
    const shelves: HomeShelf[] = [];

    for (const { video } of history
      .filter(isStrongWatch)
      .slice(0, HOME_SHELVES.becauseWatchedShelves)) {
      const related = await this.deps.related.of(video, viewer);
      if (isErr(related)) return related;

      shelves.push({
        kind: 'because-watched',
        subject: { kind: 'video', id: video.id, name: video.title ?? '' },
        items: related.value
          .filter((item) => !watched.has(item.id))
          .slice(0, HOME_SHELVES.shelfSize),
      });
    }
    return ok(shelves);
  }

  private async categoryShelves(
    seen: readonly Pick<VideoRecord, 'categoryId'>[],
    trending: readonly Pick<VideoRecord, 'categoryId'>[]
  ): Promise<Result<HomeShelf[], ShelfFailure>> {
    const categories = await this.deps.categories.findAll({ activeOnly: true });
    if (isErr(categories)) return categories;

    const names = new Map(categories.value.map(({ id, name }) => [id, name]));
    const picked = [
      ...new Set([
        ...topCategoryIds(seen, HOME_SHELVES.categoryShelves),
        ...topCategoryIds(trending, HOME_SHELVES.categoryShelves),
      ]),
    ]
      .filter((id) => names.has(id))
      .slice(0, HOME_SHELVES.categoryShelves);

    const shelves: HomeShelf[] = [];
    for (const id of picked) {
      const cards = await this.deps.videoService.listPublic({
        categoryId: id,
        sort: 'popular',
        limit: HOME_SHELVES.shelfSize,
      });
      if (isErr(cards)) return cards;

      const summaries = await this.deps.videoService.withChannels(cards.value.items);
      if (isErr(summaries)) return summaries;

      shelves.push({
        kind: 'category',
        subject: { kind: 'category', id, name: names.get(id) ?? '' },
        items: reasoned(summaries.value, () => ({ kind: 'category', subjectId: id })),
      });
    }
    return ok(shelves);
  }

  private async trendingShelf(
    cards: readonly VideoCardView[]
  ): Promise<Result<HomeShelf[], ShelfFailure>> {
    const summaries = await this.deps.videoService.withChannels(cards);
    if (isErr(summaries)) return summaries;

    return ok([
      { kind: 'trending', items: reasoned(summaries.value, () => ({ kind: 'trending' })) },
    ]);
  }

  private async withProgress(
    viewer: UserContext | null,
    shelves: readonly HomeShelf[]
  ): Promise<HomeShelf[]> {
    const marked = await this.deps.viewerProgress.attach(
      viewer,
      shelves.flatMap((shelf) => shelf.items)
    );
    let offset = 0;
    return shelves.map((shelf) => {
      const items = marked.slice(offset, offset + shelf.items.length);
      offset += shelf.items.length;
      return { ...shelf, items };
    });
  }

  private async readCache(key: string): Promise<HomeResponse | null> {
    const raw = unwrapOr(await this.deps.cache.get(key), null);
    if (raw === null) return null;

    const parsed = parseJson(raw);
    if (!isOk(parsed)) return null;

    const page = getHome.result.safeParse(parsed.value);
    return page.success ? page.data : null;
  }
}

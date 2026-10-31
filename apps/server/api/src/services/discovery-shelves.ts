import type { HomeShelf, ReasonedVideo } from '@vp/api-contracts';
import type {
  RisingVideosRepositoryPort,
  SearchHistoryRepositoryPort,
} from '@vp/core/repositories';
import { HOME_SHELVES, RISING, type WatchHistoryEntry } from '@vp/domain';
import { MS_PER_DAY, MS_PER_HOUR } from '@vp/domain/time';
import type { UserContext } from '@vp/permissions';
import { type Result, isErr, ok } from '@vp/result';
import type { SearchService } from './search-service';
import type { ListVideosFailure, VideoService } from './video-service';
import type { VideoSummaryView } from './video-views';

type Reason = ReasonedVideo['reason'];
export type ShelfFailure = ListVideosFailure;

export function reasoned(
  items: readonly VideoSummaryView[],
  reason: (item: VideoSummaryView) => Reason
): ReasonedVideo[] {
  return items.slice(0, HOME_SHELVES.shelfSize).map((item) => ({ ...item, reason: reason(item) }));
}

export interface DiscoveryShelvesDeps {
  searchHistory: SearchHistoryRepositoryPort;
  search: Pick<SearchService, 'search'>;
  rising: RisingVideosRepositoryPort;
  videoService: VideoService;
  now: () => number;
}

/** The two home shelves that come from outside the viewer's watching: their latest search, and small channels people finish. */
export class DiscoveryShelves {
  constructor(private readonly deps: DiscoveryShelvesDeps) {}

  async becauseSearched(viewer: UserContext | null): Promise<Result<HomeShelf[], ShelfFailure>> {
    if (!viewer) return ok([]);

    const latest = await this.deps.searchHistory.list(viewer.id, { cursor: null, limit: 1 });
    if (isErr(latest)) return latest;

    const entry = latest.value[0];
    const since = this.deps.now() - HOME_SHELVES.searchedWindowHours * MS_PER_HOUR;
    if (!entry || entry.searchedAt.getTime() < since) return ok([]);

    const found = await this.deps.search.search(
      {
        q: entry.query,
        type: 'video',
        sort: 'relevance',
        limit: HOME_SHELVES.searchedFetch,
        record: false,
      },
      viewer
    );
    if (isErr(found)) return ok([]);

    const videos = found.value.data.items.flatMap((hit) =>
      hit.type === 'video' && !hit.data.viewer ? [hit.data] : []
    );
    return ok([
      {
        kind: 'because-searched',
        subject: { kind: 'query', id: entry.id, name: entry.query },
        items: reasoned(videos, () => ({ kind: 'searched', subjectId: entry.id })),
      },
    ]);
  }

  async rising(
    viewer: UserContext | null,
    history: readonly WatchHistoryEntry[]
  ): Promise<Result<HomeShelf[], ShelfFailure>> {
    const found = await this.deps.rising.find({
      since: new Date(this.deps.now() - RISING.windowDays * MS_PER_DAY),
      excludeOwnerId: viewer?.id ?? null,
      excludeVideoIds: history.map((entry) => entry.videoId),
      limit: HOME_SHELVES.shelfSize,
    });
    if (isErr(found)) return found;

    const summaries = await this.deps.videoService.summarize(found.value);
    if (isErr(summaries)) return summaries;

    return ok([
      {
        kind: 'rising',
        items: reasoned(summaries.value, ({ channel }) => ({
          kind: 'rising',
          subjectId: channel?.id,
        })),
      },
    ]);
  }
}

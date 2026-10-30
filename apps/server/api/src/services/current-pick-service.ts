import { CurrentPickSchema, type CurrentPickView } from '@vp/api-contracts';
import type { PickRepositoryPort } from '@vp/core/repositories';
import { decidePickVideo, type NothingToPick, nothingToPick } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import { err, isErr, isOk, map, ok, type Result } from '@vp/result';
import type { CurrentPickCache } from './current-pick-cache';
import type { FeedService } from './feed-service';
import { buildCacheHeaders, generateEtag, isNotModified } from './http-cache';
import { toFallbackView, toScheduledView } from './pick-views';
import type { ListVideosFailure } from './video-service';
import type { SpriteGeometry } from './video-views';

export interface CurrentPickServiceDeps {
  picks: PickRepositoryPort;
  feed: Pick<FeedService, 'getFeed'>;
  currentCache: CurrentPickCache;
  cdn: CdnBase;
  sprite: SpriteGeometry;
  maxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
  now: () => number;
}

export interface CurrentPickPage {
  data: CurrentPickView;
  headers: Record<string, string>;
  notModified: boolean;
}

export type CurrentPickServiceFailure = ListVideosFailure | NothingToPick;

/**
 * Windows never overlap, so there is no "next" pick to fall to when the current one's video
 * stopped being public and ready: the top trending video stands in until the window ends.
 */
export class CurrentPickService {
  constructor(private readonly deps: CurrentPickServiceDeps) {}

  async current(ifNoneMatch?: string): Promise<Result<CurrentPickPage, CurrentPickServiceFailure>> {
    const at = this.deps.now();
    const cached = await this.deps.currentCache.read(at);
    const resolved = cached ? ok(cached) : await this.resolve(at);
    return map(resolved, (data) => this.page(data, at, ifNoneMatch));
  }

  private async resolve(at: number): Promise<Result<CurrentPickView, CurrentPickServiceFailure>> {
    const found = await this.deps.picks.findCurrent(new Date(at));
    if (isErr(found)) return found;

    const entry = found.value;
    if (entry && isOk(decidePickVideo(entry.video, entry.video.id))) {
      const view = toScheduledView(entry, this.deps.cdn, this.deps.sprite);
      await this.deps.currentCache.write(view, at);
      return ok(view);
    }
    return this.fallback();
  }

  private async fallback(): Promise<Result<CurrentPickView, CurrentPickServiceFailure>> {
    const trending = await this.deps.feed.getFeed({ sort: 'trending', limit: 1 });
    if (isErr(trending)) return trending;

    const [top] = trending.value.data.items;
    return top ? ok(toFallbackView(top)) : err(nothingToPick());
  }

  private page(data: CurrentPickView, at: number, ifNoneMatch?: string): CurrentPickPage {
    const { maxAgeSeconds, staleWhileRevalidateSeconds } = this.deps;
    const secondsLeft = data.endsAt
      ? Math.ceil((new Date(data.endsAt).getTime() - at) / 1000)
      : Infinity;
    // Keyed after the schema, because a cached read comes back in the schema's key order.
    const keyed = CurrentPickSchema.safeParse(data);
    const etag = generateEtag(keyed.success ? keyed.data : data);
    return {
      data,
      notModified: isNotModified(ifNoneMatch, etag),
      headers: buildCacheHeaders({
        etag,
        maxAgeSeconds: Math.min(maxAgeSeconds, secondsLeft),
        staleWhileRevalidateSeconds: Math.min(staleWhileRevalidateSeconds, secondsLeft),
      }),
    };
  }
}

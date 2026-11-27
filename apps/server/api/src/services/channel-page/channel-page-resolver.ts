import { type Singleflight } from '@kit/concurrency';
import { type Result, ignore, isErr, isOk, ok, parseJson, unwrapOr } from '@kit/result';
import type { ChannelPageView } from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import type {
  ChannelPageSourceRepositoryPort,
  WatchHistoryRepositoryPort,
} from '@vp/core/repositories';
import {
  type Channel,
  type ChannelLayout,
  type ViewerAudience,
  isWatchCompleted,
} from '@vp/domain';
import type { ChannelNotFound } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import { CacheKeys } from '@vp/events';
import { uuidv7 } from 'uuidv7';
import { planPage } from './channel-page-plan';
import { type PagePool, PagePoolSchema, loadPagePool } from './channel-page-pool';
import { assemblePage, selectTab, watchCandidates } from './channel-page-view';

const POOL_FRESH_SECONDS = 60;

export interface ChannelPageResolverDeps {
  sources: ChannelPageSourceRepositoryPort;
  history: Pick<WatchHistoryRepositoryPort, 'findMany'>;
  cache: Pick<CacheClient, 'get' | 'set'>;
  singleflight: Pick<Singleflight, 'do'>;
  cdn: CdnBase;
  now: () => number;
}

export interface ResolveRequest {
  channel: Channel;
  layout: ChannelLayout;
  /** The published revision the layout is; null for the default layout and for a draft. */
  revision: number | null;
  /** A draft is never cached. */
  cached: boolean;
  audience: ViewerAudience;
  locales: readonly string[];
  viewerId: string | null;
  tab: string | undefined;
  seed: string | undefined;
  idOrHandle: string;
}

export type ResolvePageFailure = ChannelNotFound | DatabaseUnavailable;

/**
 * Resolves a layout for one viewer. The pool of every section's items is the same for everyone of
 * an audience and locale, so it is cached per revision for a minute behind singleflight; windows,
 * the seeded order and the viewer's own watch history are applied after it.
 */
export class ChannelPageResolver {
  constructor(private readonly deps: ChannelPageResolverDeps) {}

  async resolve(request: ResolveRequest): Promise<Result<ChannelPageView, ResolvePageFailure>> {
    const { layout, audience, locales, channel } = request;
    const now = new Date(this.deps.now());
    const pooled = await this.pool(request, now);
    if (isErr(pooled)) return pooled;
    const pool = pooled.value;

    const viewer = { audience, now, locales };
    const selection = selectTab(layout, pool, viewer, request.tab, request.idOrHandle);
    if (isErr(selection)) return selection;

    const watched = await this.watchedAmong(
      request.viewerId,
      watchCandidates(selection.value.tab, pool, viewer)
    );
    if (isErr(watched)) return watched;
    return ok(
      assemblePage({
        channelId: channel.id,
        revision: request.revision,
        selection: selection.value,
        context: { layout, pool, seed: request.seed ?? uuidv7(), watched: watched.value },
        viewer,
      })
    );
  }

  private async pool(
    request: ResolveRequest,
    now: Date
  ): Promise<Result<PagePool, DatabaseUnavailable>> {
    const { channel, layout, audience, locales } = request;
    const load = () =>
      loadPagePool(
        this.deps.sources,
        this.deps.cdn,
        channel.id,
        channel.userId,
        planPage({ layout, audience, locales, now }),
        now
      );
    if (!request.cached) return load();

    const key = CacheKeys.channelPagePool(
      channel.id,
      request.revision ?? 0,
      audience,
      locales.join('|')
    );
    const hit = await this.read(key);
    if (hit) return ok(hit);
    return this.deps.singleflight.do(key, async () => {
      const loaded = await load();
      if (isOk(loaded)) await this.write(key, loaded.value);
      return loaded;
    });
  }

  private async read(key: string): Promise<PagePool | null> {
    const raw = unwrapOr(await this.deps.cache.get(key), null);
    if (raw === null) return null;
    const parsed = parseJson(raw);
    if (!isOk(parsed)) return null;
    const pool = PagePoolSchema.safeParse(parsed.value);
    return pool.success ? pool.data : null;
  }

  private async write(key: string, pool: PagePool): Promise<void> {
    ignore(
      await this.deps.cache.set(key, JSON.stringify(pool), POOL_FRESH_SECONDS),
      'a cold cache costs one resolution, never a wrong page'
    );
  }

  private async watchedAmong(
    viewerId: string | null,
    videoIds: readonly string[]
  ): Promise<Result<ReadonlySet<string>, DatabaseUnavailable>> {
    if (viewerId === null || videoIds.length === 0) return ok(new Set());
    const progress = await this.deps.history.findMany(viewerId, videoIds);
    if (isErr(progress)) return progress;
    return ok(new Set(progress.value.filter(isWatchCompleted).map(({ videoId }) => videoId)));
  }
}

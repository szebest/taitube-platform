import type { CacheClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { UserEvent } from '@vp/domain';
import { publishVideoEvent, userChannel } from '@vp/events';
import type { Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import { ignore, isOk, map, unwrapOr } from '@vp/result';

export interface ProgressReporterDeps {
  cache: CacheClient;
  repositories: Repositories;
  metrics: PipelineMetrics;
  videoId: string;
  rendition: string;
  logger: Logger;
  now: () => number;
}

/** What one transcode names; the cache, the store and the metrics come from composition. */
export type ProgressTarget = Pick<ProgressReporterDeps, 'videoId' | 'rendition' | 'logger'>;

export interface ProgressReporter {
  report(percent: number): Promise<void>;
}

/**
 * Throttles live progress to one publish per two seconds per rendition, persists a `progress`
 * event only at each 10 % decile, and reports the ladder's overall progress (SDD §10.1): a sibling
 * still encoding counts at its last persisted percent, the figure GET /v1/videos/:id shows. A
 * target outside the ladder, the thumbnail stage, reports its own percent and adds nothing to the
 * overall.
 *
 * Progress is advisory: a store or a cache that cannot take a sample costs the client one
 * update, never the transcode, so every failure here is dropped.
 */
export class TranscodeProgressReporter implements ProgressReporter {
  private lastPublishTime = 0;
  private lastPersistedDecile = 0;
  private owner: Promise<string | undefined> | undefined;

  constructor(private readonly deps: ProgressReporterDeps) {}

  async report(percent: number): Promise<void> {
    const now = this.deps.now();
    if (now - this.lastPublishTime < 2000 && percent < 100) return;
    this.lastPublishTime = now;

    const currentDecile = Math.floor(percent / 10);
    const shouldPersist = currentDecile > this.lastPersistedDecile && percent >= 10;
    if (shouldPersist) {
      this.lastPersistedDecile = currentDecile;
    }

    const renditions = unwrapOr(
      await this.deps.repositories.renditions.findByVideoId(this.deps.videoId),
      []
    );

    let overall = percent;
    if (renditions.length > 0) {
      const lastPersisted = await this.persistedPercents();
      const shares = renditions.map((r) => {
        if (r.name === this.deps.rendition) return percent;
        if (r.status === 'DONE') return 100;
        return lastPersisted.get(r.name) ?? 0;
      });
      overall = Math.round(shares.reduce((sum, share) => sum + share, 0) / renditions.length);
    }

    let eventId: number | undefined;
    if (shouldPersist) {
      const record = await this.deps.repositories.events.create({
        videoId: this.deps.videoId,
        type: 'progress',
        payload: { rendition: this.deps.rendition, percent, overall, ts: now },
      });
      if (isOk(record)) eventId = record.value.id;
    }

    const published = await publishVideoEvent({
      cache: this.deps.cache,
      videoId: this.deps.videoId,
      event: 'progress',
      data: { rendition: this.deps.rendition, percent, overall },
      id: eventId,
      ts: now,
    });
    if (isOk(published)) this.deps.metrics.sseEventsPublished.inc({ event: 'progress' });

    const ownerId = await this.ownerId();
    if (!ownerId) return;
    const tick: UserEvent = {
      type: 'video.processing',
      payload: {
        videoId: this.deps.videoId,
        change: { kind: 'progress', rendition: this.deps.rendition, percent, overall },
      },
    };
    ignore(
      await this.deps.cache.publish(userChannel(ownerId), JSON.stringify(tick)),
      'a tick the owner misses is replaced by the next one or the status that follows'
    );
  }

  private async persistedPercents(): Promise<Map<string, number>> {
    const percents = new Map<string, number>();
    const events = unwrapOr(
      await this.deps.repositories.events.findByVideoId(this.deps.videoId),
      []
    );
    for (const { type, payload } of events) {
      const sample = payload as { rendition?: unknown; percent?: unknown } | null;
      const rendition = sample?.rendition;
      const percent = sample?.percent;
      if (type !== 'progress' || typeof rendition !== 'string' || typeof percent !== 'number') {
        continue;
      }
      percents.set(rendition, Math.max(percents.get(rendition) ?? 0, percent));
    }
    return percents;
  }

  private ownerId(): Promise<string | undefined> {
    this.owner ??= this.deps.repositories.videos.findById(this.deps.videoId).then((found) =>
      unwrapOr(
        map(found, (video) => video?.ownerId),
        undefined
      )
    );
    return this.owner;
  }
}

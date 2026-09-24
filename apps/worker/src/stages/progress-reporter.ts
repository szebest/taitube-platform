import type { CacheClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { publishVideoEvent } from '@vp/events';
import type { PipelineMetrics } from '@vp/observability';
import type { Logger } from '@vp/logger';
import { isOk, unwrapOr } from '@vp/result';

export interface ProgressReporterDeps {
  cache: CacheClient;
  repositories: Repositories;
  metrics: PipelineMetrics;
  videoId: string;
  rendition: string;
  logger: Logger;
}

/** What one transcode names; the cache, the store and the metrics come from composition. */
export type ProgressTarget = Pick<ProgressReporterDeps, 'videoId' | 'rendition' | 'logger'>;

export interface ProgressReporter {
  report(percent: number): Promise<void>;
}

/**
 * Throttles live progress to one publish per two seconds per rendition, persists a `progress`
 * event only at each 10 % decile, and reports the ladder's overall progress (SDD §10.1).
 *
 * Progress is advisory: a store or a cache that cannot take a sample costs the client one
 * update, never the transcode, so every failure here is dropped.
 */
export class TranscodeProgressReporter implements ProgressReporter {
  private lastPublishTime = 0;
  private lastPersistedDecile = 0;

  constructor(private readonly deps: ProgressReporterDeps) {}

  async report(percent: number): Promise<void> {
    const now = Date.now();
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
      const doneCount = renditions.filter(
        (r) => r.status === 'DONE' && r.name !== this.deps.rendition
      ).length;
      overall = Math.round((doneCount * 100 + percent) / renditions.length);
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
  }
}

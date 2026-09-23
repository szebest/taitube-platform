import type { CacheClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { publishVideoEvent } from '@vp/events';
import { type Logger, getMetrics } from '@vp/observability';
import { isOk, unwrapOr } from '@vp/result';

export interface ProgressReporterDeps {
  cache?: CacheClient;
  repositories: Repositories;
  videoId: string;
  rendition: string;
  logger: Logger;
}

/**
 * TranscodeProgressReporter — Manages progress throttling and persistence (SDD §10.1, AC 4).
 *
 * Rules:
 * - Throttles pub/sub progress notifications to at most 1 per 2 seconds per rendition.
 * - Persists progress events to Postgres video_events only at 10% decile boundaries.
 * - Computes overall ladder progress across all renditions.
 */
export class TranscodeProgressReporter {
  private lastPublishTime = 0;
  private lastPersistedDecile = 0;

  constructor(private readonly deps: ProgressReporterDeps) {}

  /**
   * Progress is advisory: a store or a cache that cannot take a sample costs the client one
   * update, never the transcode. Every failure here is deliberately dropped.
   */
  async report(percent: number): Promise<void> {
    const now = Date.now();
    if (now - this.lastPublishTime < 2000 && percent < 100) return;
    this.lastPublishTime = now;

    const cache = this.deps.cache;
    if (!cache) return;

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

    await publishVideoEvent({
      cache,
      videoId: this.deps.videoId,
      event: 'progress',
      data: { rendition: this.deps.rendition, percent, overall },
      id: eventId,
      ts: now,
    });

    getMetrics().sseEventsPublished.inc({ event: 'progress' });
  }
}

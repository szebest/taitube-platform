import type { CacheClient, Repositories } from '@vp/core/ports';
import { publishVideoEvent } from '@vp/events';
import { type Logger, getMetrics } from '@vp/observability';

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

  async report(percent: number): Promise<void> {
    const now = Date.now();
    if (now - this.lastPublishTime < 2000 && percent < 100) {
      return;
    }
    this.lastPublishTime = now;

    if (!this.deps.cache) {
      return;
    }

    try {
      const currentDecile = Math.floor(percent / 10);
      const shouldPersist = currentDecile > this.lastPersistedDecile && percent >= 10;
      if (shouldPersist) {
        this.lastPersistedDecile = currentDecile;
      }

      let overall = percent;
      const renditions = await this.deps.repositories.renditions
        .findByVideoId(this.deps.videoId)
        .catch(() => []);

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
          payload: {
            rendition: this.deps.rendition,
            percent,
            overall,
            ts: now,
          },
        });
        eventId = record?.id;
      }

      await publishVideoEvent({
        cache: this.deps.cache,
        videoId: this.deps.videoId,
        event: 'progress',
        data: {
          rendition: this.deps.rendition,
          percent,
          overall,
        },
        id: eventId,
        ts: now,
      });

      getMetrics().sseEventsPublished.inc({ event: 'progress' });
    } catch (err) {
      this.deps.logger.warn({ err, percent }, 'Failed to report transcode progress');
    }
  }
}

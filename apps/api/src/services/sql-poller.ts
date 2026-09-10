import type { Repositories } from '@vp/core/ports';
import type { PipelineMetrics } from '@vp/observability';

export interface SqlPollerOptions {
  repositories: Repositories;
  metrics: PipelineMetrics;
  /** Poll interval in ms. Default: 30000 */
  intervalMs?: number;
}

export interface SqlPoller {
  stop: () => void;
}

/**
 * Polls the database every `intervalMs` and writes:
 *  - videos_by_status{status} (gauge) — count of videos grouped by status
 *
 * Note: time_to_ready_seconds is observed at the worker stage transition
 * when a video reaches READY status (in package stage).
 *
 * Ticket 22 AC 2.
 */
export function startSqlPoller(options: SqlPollerOptions): SqlPoller {
  const { repositories, metrics, intervalMs = 30_000 } = options;
  let stopped = false;

  async function poll(): Promise<void> {
    try {
      const counts = await repositories.videos.countByStatus();
      for (const [status, count] of Object.entries(counts)) {
        metrics.videosByStatus.set({ status }, count);
      }
    } catch {
      // DB unavailable — skip silently
    }
  }

  const timer = setInterval(() => {
    if (!stopped) {
      poll().catch(() => {});
    }
  }, intervalMs);

  // Run once immediately
  poll().catch(() => {});

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}

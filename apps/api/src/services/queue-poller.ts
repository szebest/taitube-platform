import type { JobQueue, QueueJobCounts } from '@vp/core/ports';
import type { PipelineMetrics } from '@vp/observability';
import { isOk } from '@vp/result';

/**
 * Maps from the port's QueueJobCounts shape to Prometheus label values.
 * Note: the port type does not include 'prioritized' or 'waiting-children'
 * since those are BullMQ-specific. We expose the port-level fields only.
 */
const QUEUE_STATE_KEYS: ReadonlyArray<keyof QueueJobCounts> = [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
] as const;

export interface QueuePollerOptions {
  queues: Map<string, JobQueue>;
  metrics: PipelineMetrics;
  /** Poll interval in ms. Default: 5000 */
  intervalMs?: number;
}

export interface QueuePoller {
  stop: () => void;
}

/**
 * Polls BullMQ queues every `intervalMs` and writes:
 *  - bullmq_queue_jobs{queue, state}                (gauge)
 *  - bullmq_queue_oldest_waiting_age_seconds{queue}  (gauge)
 *
 * Ticket 22 AC 2.
 */
/** BullMQ stamps a job with `timestamp`; the port shape does not carry it, so it is read defensively. */
function oldestWaitingAgeSeconds(waiting: readonly unknown[]): number {
  const oldest = waiting[0];
  if (!oldest) return 0;

  const enqueuedAt = (oldest as { timestamp?: number }).timestamp ?? Date.now();
  return Math.max(0, (Date.now() - enqueuedAt) / 1000);
}

export function startQueuePoller(options: QueuePollerOptions): QueuePoller {
  const { queues, metrics, intervalMs = 5_000 } = options;
  let stopped = false;

  // A queue that cannot answer leaves its gauges where they were: a scrape is not a request, and
  // one unreachable queue must not cost the others their sample.
  async function poll(): Promise<void> {
    for (const [name, queue] of queues) {
      const counts = await queue.getJobCounts();
      if (isOk(counts)) {
        for (const state of QUEUE_STATE_KEYS) {
          metrics.bullmqQueueJobs.set(
            { queue: name, state: String(state) },
            counts.value[state] ?? 0
          );
        }
      }

      const waiting = await queue.getJobs(['waiting']);
      metrics.bullmqQueueOldestWaitingAge.set(
        { queue: name },
        isOk(waiting) ? oldestWaitingAgeSeconds(waiting.value) : 0
      );
    }
  }

  const timer = setInterval(() => {
    if (!stopped) {
      poll().catch(() => {});
    }
  }, intervalMs);

  // Run once immediately (fire-and-forget)
  poll().catch(() => {});

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}

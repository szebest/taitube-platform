import type { JobQueue, QueueJobCounts } from '@vp/core/ports';
import type { PipelineMetrics } from '@vp/observability';

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
export function startQueuePoller(options: QueuePollerOptions): QueuePoller {
  const { queues, metrics, intervalMs = 5_000 } = options;
  let stopped = false;

  async function poll(): Promise<void> {
    for (const [name, queue] of queues) {
      try {
        const counts = await queue.getJobCounts();

        for (const state of QUEUE_STATE_KEYS) {
          metrics.bullmqQueueJobs.set({ queue: name, state: String(state) }, counts[state] ?? 0);
        }

        // Oldest waiting job age — peek at head of waiting jobs via getJobs(['waiting'])
        try {
          const waitingJobs = await queue.getJobs(['waiting']);
          if (waitingJobs.length > 0) {
            // Jobs are returned oldest-first; first element is oldest
            const oldest = waitingJobs[0];
            // BullMQ jobs have a `timestamp` property; the port exposes QueueJob which lacks it.
            // Use duck-typing to read it safely.
            const enqueuedAt =
              (oldest as unknown as { timestamp?: number }).timestamp ?? Date.now();
            const ageSeconds = Math.max(0, (Date.now() - enqueuedAt) / 1000);
            metrics.bullmqQueueOldestWaitingAge.set({ queue: name }, ageSeconds);
          } else {
            metrics.bullmqQueueOldestWaitingAge.set({ queue: name }, 0);
          }
        } catch {
          // getJobs may not be implemented in all test doubles; skip gracefully
          metrics.bullmqQueueOldestWaitingAge.set({ queue: name }, 0);
        }
      } catch {
        // Individual queue failure must not crash the poller
      }
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

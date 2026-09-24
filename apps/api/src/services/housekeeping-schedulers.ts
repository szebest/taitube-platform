import type { JobQueue } from '@vp/core/ports';
import type { QueueUnavailable } from '@vp/errors';
import { type Result, isErr, ok } from '@vp/result';

const HOUSEKEEPING_SCHEDULER_CONFIGS = [
  { id: 'reconcile-uploads', pattern: '*/15 * * * *' },
  { id: 'reconcile-processing', pattern: '*/10 * * * *' },
  { id: 'purge-deleted', pattern: '0 * * * *' },
  { id: 'expire-raw', pattern: '30 3 * * *' },
  { id: 'tmp-sweep', pattern: '*/30 * * * *' },
  { id: 'reconcile-reaction-counters', pattern: '0 * * * *' },
] as const;

/**
 * Registers the housekeeping Job Schedulers the API upserts idempotently on boot. A queue that
 * cannot take one is returned to the composition root, which decides whether to boot without it.
 */
export async function registerHousekeepingSchedulers(
  queue: JobQueue,
  overrides?: Partial<Record<string, string>>
): Promise<Result<void, QueueUnavailable>> {
  for (const config of HOUSEKEEPING_SCHEDULER_CONFIGS) {
    const pattern = overrides?.[config.id] ?? config.pattern;
    const upserted = await queue.upsertJobScheduler(
      config.id,
      { pattern },
      {
        name: config.id,
        data: { task: config.id },
      }
    );
    if (isErr(upserted)) return upserted;
  }

  return ok();
}

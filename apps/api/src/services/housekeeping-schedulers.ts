import type { JobQueue, UpsertJobSchedulerOptions } from '@vp/core/ports';
import type { QueueUnavailable } from '@vp/errors';
import type { HousekeepingJob } from '@vp/job-contracts';
import { type Result, isErr, ok } from '@vp/result';

type HousekeepingTask = HousekeepingJob['task'];

const CRON_SCHEDULERS = [
  { id: 'reconcile-uploads', pattern: '*/15 * * * *' },
  { id: 'reconcile-processing', pattern: '*/10 * * * *' },
  { id: 'purge-deleted', pattern: '0 * * * *' },
  { id: 'expire-raw', pattern: '30 3 * * *' },
  { id: 'tmp-sweep', pattern: '*/30 * * * *' },
  { id: 'reconcile-reaction-counters', pattern: '0 * * * *' },
] as const satisfies readonly { id: HousekeepingTask; pattern: string }[];

export interface HousekeepingScheduleSettings {
  /** Cron has minute resolution; the view flush runs every few seconds, so it repeats on a timer. */
  flushIntervalMs: number;
  patterns?: Partial<Record<HousekeepingTask, string>>;
}

/**
 * Registers the housekeeping Job Schedulers the API upserts idempotently on boot. A queue that
 * cannot take one is returned to the composition root, which decides whether to boot without it.
 */
export async function registerHousekeepingSchedulers(
  queue: JobQueue,
  settings: HousekeepingScheduleSettings
): Promise<Result<void, QueueUnavailable>> {
  const schedulers: { id: HousekeepingTask; repeat: UpsertJobSchedulerOptions }[] = [
    ...CRON_SCHEDULERS.map(({ id, pattern }) => ({
      id,
      repeat: { pattern: settings.patterns?.[id] ?? pattern },
    })),
    { id: 'flush-video-views', repeat: { every: settings.flushIntervalMs } },
  ];

  for (const { id, repeat } of schedulers) {
    const upserted = await queue.upsertJobScheduler(id, repeat, {
      name: id,
      data: { task: id } satisfies HousekeepingJob,
    });
    if (isErr(upserted)) return upserted;
  }

  return ok();
}

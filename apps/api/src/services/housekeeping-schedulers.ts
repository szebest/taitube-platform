import type { JobQueue } from '@vp/core/ports';

export interface HousekeepingSchedulerConfig {
  id: string;
  pattern: string;
}

export const HOUSEKEEPING_SCHEDULER_CONFIGS: readonly HousekeepingSchedulerConfig[] = [
  { id: 'reconcile-uploads', pattern: '*/15 * * * *' },
  { id: 'reconcile-processing', pattern: '*/10 * * * *' },
  { id: 'purge-deleted', pattern: '0 * * * *' },
  { id: 'expire-raw', pattern: '30 3 * * *' },
  { id: 'tmp-sweep', pattern: '*/30 * * * *' },
  { id: 'reconcile-reaction-counters', pattern: '0 * * * *' },
] as const;

/**
 * Register BullMQ Job Schedulers for Housekeeping (SDD §9.8, AC 1).
 * Upserted idempotently by the API on boot.
 */
export async function registerHousekeepingSchedulers(
  queue: JobQueue,
  overrides?: Partial<Record<string, string>>
): Promise<void> {
  for (const config of HOUSEKEEPING_SCHEDULER_CONFIGS) {
    const pattern = overrides?.[config.id] ?? config.pattern;
    await queue.upsertJobScheduler(
      config.id,
      { pattern },
      {
        name: config.id,
        data: { task: config.id },
      }
    );
  }
}

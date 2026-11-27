import type { DatabaseUnavailable } from '@kit/errors';
import type { Logger } from '@kit/logger';
import { MS_PER_DAY } from '@kit/primitives';
import { type Result, isErr, ok } from '@kit/result';
import type { Repositories } from '@vp/core/repositories';

export interface PurgeSearchHistoryOptions {
  repositories: Repositories;
  retentionDays: number;
  now: () => number;
  logger?: Logger;
}

export interface PurgeSearchHistoryResult {
  purgedCount: number;
}

/** Search history keeps a viewer's trail for the retention window and no longer (SDD §9.8). */
export async function runPurgeSearchHistory(
  options: PurgeSearchHistoryOptions
): Promise<Result<PurgeSearchHistoryResult, DatabaseUnavailable>> {
  const { repositories, retentionDays, now, logger } = options;

  const purged = await repositories.searchHistory.purgeOlderThan(
    new Date(now() - retentionDays * MS_PER_DAY)
  );
  if (isErr(purged)) return purged;

  logger?.info({ purgedCount: purged.value }, 'purged search history past its retention');
  return ok({ purgedCount: purged.value });
}

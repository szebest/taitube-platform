import type { Repositories } from '@vp/core/repositories';
import { MS_PER_DAY } from '@vp/domain/time';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Logger } from '@vp/logger';
import { type Result, isErr, ok } from '@vp/result';

export interface PurgeHandleHistoryOptions {
  repositories: Repositories;
  reservationDays: number;
  now: () => number;
  logger?: Logger;
}

export interface PurgeHandleHistoryResult {
  purgedCount: number;
}

/** A handle a channel gave up is held for its old owner for the reservation window; this frees the rest. */
export async function runPurgeHandleHistory(
  options: PurgeHandleHistoryOptions
): Promise<Result<PurgeHandleHistoryResult, DatabaseUnavailable>> {
  const { repositories, reservationDays, now, logger } = options;

  const purged = await repositories.channelHandleHistory.purgeOlderThan(
    new Date(now() - reservationDays * MS_PER_DAY)
  );
  if (isErr(purged)) return purged;

  logger?.info(
    { purgedCount: purged.value },
    'freed retired channel handles past their reservation'
  );
  return ok({ purgedCount: purged.value });
}

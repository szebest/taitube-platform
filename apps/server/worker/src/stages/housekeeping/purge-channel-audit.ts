import type { DatabaseUnavailable } from '@kit/errors';
import type { Logger } from '@kit/logger';
import { MS_PER_DAY } from '@kit/primitives';
import { type Result, isErr, ok } from '@kit/result';
import type { Repositories } from '@vp/core/repositories';

export interface PurgeChannelAuditOptions {
  repositories: Repositories;
  retentionDays: number;
  now: () => number;
  logger?: Logger;
}

export interface PurgeChannelAuditResult {
  purgedCount: number;
}

/** The channel audit log is append-only; this retention purge is the one thing that deletes from it. */
export async function runPurgeChannelAudit(
  options: PurgeChannelAuditOptions
): Promise<Result<PurgeChannelAuditResult, DatabaseUnavailable>> {
  const { repositories, retentionDays, now, logger } = options;

  const purged = await repositories.channelAudit.purgeOlderThan(
    new Date(now() - retentionDays * MS_PER_DAY)
  );
  if (isErr(purged)) return purged;

  logger?.info({ purgedCount: purged.value }, 'purged channel audit rows past their retention');
  return ok({ purgedCount: purged.value });
}

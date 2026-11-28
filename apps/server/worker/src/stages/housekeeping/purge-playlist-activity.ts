import type { Logger } from '@kit/logger';
import { MS_PER_DAY } from '@kit/primitives';
import { type Result, isErr, ok } from '@kit/result';
import type { Repositories } from '@vp/core/repositories';
import { PLAYLIST_ACTIVITY_RETENTION_DAYS } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export interface PurgePlaylistActivityOptions {
  repositories: Pick<Repositories, 'playlistActivity'>;
  now: () => number;
  logger?: Logger;
}

/** A playlist keeps 180 days of its log; older rows, and what they could restore, go. */
export async function runPurgePlaylistActivity(
  options: PurgePlaylistActivityOptions
): Promise<Result<{ purgedCount: number }, DatabaseUnavailable>> {
  const { repositories, now, logger } = options;

  const purged = await repositories.playlistActivity.purgeOlderThan(
    new Date(now() - PLAYLIST_ACTIVITY_RETENTION_DAYS * MS_PER_DAY)
  );
  if (isErr(purged)) return purged;

  logger?.info({ purgedCount: purged.value }, 'purged playlist activity past its retention');
  return ok({ purgedCount: purged.value });
}

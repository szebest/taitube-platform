import type { Logger } from '@kit/logger';
import { type Result, err, isErr, ok } from '@kit/result';
import type { StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { DATA_EXPORT_STALE_AFTER_MS } from '@vp/domain';
import type { DatabaseUnavailable, StorageUnavailable } from '@vp/errors';

export interface PurgeExportsOptions {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket: string;
  scanLimit: number;
  now: () => number;
  logger?: Logger;
}

export interface PurgeExportsResult {
  purgedCount: number;
  abandonedCount: number;
}

const ABANDONED = 'The export did not finish; ask for it again';

/**
 * Fails every export whose job died without settling it, which frees the channel's one slot, then
 * deletes the file of every ready export past its expiry and marks it `expired`. An export whose
 * file could not be deleted stays ready and past due, so the next run takes it again.
 */
export async function runPurgeExports(
  options: PurgeExportsOptions
): Promise<Result<PurgeExportsResult, DatabaseUnavailable | StorageUnavailable>> {
  const { repositories, storage, rawBucket, scanLimit, now, logger } = options;

  const stale = await repositories.dataExports.listStale(
    new Date(now() - DATA_EXPORT_STALE_AFTER_MS),
    scanLimit
  );
  if (isErr(stale)) return stale;
  for (const { id } of stale.value) {
    const failed = await repositories.dataExports.fail(id, ABANDONED);
    if (isErr(failed)) return failed;
  }
  const abandonedCount = stale.value.length;

  const due = await repositories.dataExports.listExpired(new Date(now()), scanLimit);
  if (isErr(due)) return due;

  const purged: string[] = [];
  let failure: StorageUnavailable | null = null;
  for (const { id, objectKey } of due.value) {
    const removed = objectKey ? await storage.deleteObject(rawBucket, objectKey) : ok();
    if (isErr(removed)) {
      failure = removed.error;
      break;
    }
    purged.push(id);
  }

  const expired = await repositories.dataExports.expire(purged);
  if (isErr(expired)) return expired;
  logger?.info(
    { purgedCount: expired.value, abandonedCount },
    'purged export files past their expiry and failed abandoned exports'
  );
  return failure ? err(failure) : ok({ purgedCount: expired.value, abandonedCount });
}

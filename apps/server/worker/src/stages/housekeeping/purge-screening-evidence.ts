import type { StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { MS_PER_DAY } from '@vp/domain/time';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Logger } from '@vp/logger';
import { type Result, isErr, ok } from '@vp/result';
import { evidencePrefix } from '@vp/storage';

export interface PurgeScreeningEvidenceOptions {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket: string;
  retentionDays: number;
  scanLimit: number;
  now: () => number;
  logger?: Logger;
}

export interface PurgeScreeningEvidenceResult {
  purgedCount: number;
}

/**
 * Removes the evidence frames of a case once it has been closed for the retention. A case is marked
 * only after its prefix is gone, so a storage failure leaves it for the next run; the fingerprints and
 * the result row stay, because a re-upload of a rejected video is matched against them.
 */
export async function runPurgeScreeningEvidence(
  options: PurgeScreeningEvidenceOptions
): Promise<Result<PurgeScreeningEvidenceResult, DatabaseUnavailable>> {
  const { repositories, storage, rawBucket, retentionDays, scanLimit, now, logger } = options;

  const due = await repositories.screenings.findPurgeableEvidence({
    closedBefore: new Date(now() - retentionDays * MS_PER_DAY),
    limit: scanLimit,
  });
  if (isErr(due)) return due;

  let purgedCount = 0;
  for (const { id, videoId } of due.value) {
    const purged = await storage.purgePrefix(rawBucket, evidencePrefix(videoId));
    if (isErr(purged)) {
      logger?.warn(
        { videoId, storage: purged.error.operation },
        'evidence not removed; kept for the next run'
      );
      continue;
    }

    const marked = await repositories.screenings.markEvidencePurged(id);
    if (isErr(marked)) return marked;
    purgedCount += 1;
  }

  logger?.info({ purgedCount }, 'removed the evidence frames of closed screening cases');
  return ok({ purgedCount });
}

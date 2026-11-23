import type { Logger } from '@kit/logger';
import { type Result, isErr, ok } from '@kit/result';
import type { StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { VideoGeneration } from '@vp/domain';
import { IN_FLIGHT_GENERATIONS } from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes, type StorageUnavailable } from '@vp/errors';
import { generationPurgeTargets } from '@vp/storage';
import { z } from 'zod';

export interface PurgeGenerationsOptions {
  repositories: Repositories;
  storage: StorageClient;
  publicBucket: string;
  scanLimit: number;
  now: () => number;
  logger?: Logger;
}

export interface PurgeGenerationsResult {
  purgedCount: number;
  expiredUploads: number;
}

const RenditionNames = z.array(z.object({ name: z.string() }));

async function purgeObjects(
  storage: StorageClient,
  bucket: string,
  row: VideoGeneration
): Promise<Result<void, StorageUnavailable>> {
  const ladder = RenditionNames.safeParse(row.playback?.ladder);
  const renditions = ladder.success ? ladder.data.map(({ name }) => name) : [];
  for (const target of generationPurgeTargets(row.videoId, row.generation, renditions)) {
    const purged = await storage.purgePrefix(bucket, target);
    if (isErr(purged)) return purged;
  }
  return ok();
}

/**
 * Deletes the renditions of every retired generation past its grace (24 hours after a swap, 14 days
 * for an edit list's base) and fails every replacement whose upload lapsed. The objects go before the
 * row turns `purged`, so a run that stops halfway leaves the row due and the next run takes it again.
 */
export async function runPurgeGenerations(
  options: PurgeGenerationsOptions
): Promise<Result<PurgeGenerationsResult, DatabaseUnavailable | StorageUnavailable>> {
  const { repositories, storage, publicBucket, scanLimit, now, logger } = options;
  const due = await repositories.videoGenerations.listDue(new Date(now()), scanLimit);
  if (isErr(due)) return due;

  let purgedCount = 0;
  let expiredUploads = 0;
  for (const row of due.value) {
    if (IN_FLIGHT_GENERATIONS.includes(row.status)) {
      const failed = await repositories.videoGenerations.fail(
        row.videoId,
        row.generation,
        ErrorCodes.UPLOAD_EXPIRED
      );
      if (isErr(failed)) return failed;
      expiredUploads += 1;
      continue;
    }
    const removed = await purgeObjects(storage, publicBucket, row);
    if (isErr(removed)) return removed;
    const marked = await repositories.videoGenerations.markPurged(row.videoId, row.generation);
    if (isErr(marked)) return marked;
    purgedCount += 1;
  }

  logger?.info({ purgedCount, expiredUploads }, 'purged retired generations and lapsed uploads');
  return ok({ purgedCount, expiredUploads });
}

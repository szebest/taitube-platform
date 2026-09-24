import type { StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Logger } from '@vp/observability';
import { type Result, isErr, ok, unwrapOr } from '@vp/result';

export interface PurgeDeletedOptions {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket: string;
  publicBucket: string;
  thresholdMs: number;
  logger?: Logger;
}

export interface PurgeDeletedResult {
  purgedVideosCount: number;
  purgedGenerationsCount: number;
}

/**
 * Purge deleted videos and old reprocessed generations (SDD §9.8, §7, AC 4, AC 5):
 * 1. Delete objects for DELETED videos older than threshold (default 1h) via paginated purge,
 *    then hard-delete DB rows.
 * 2. Purge old generation prefixes (e.g. videos/{id}/hls/g1/) once generation > 1 is READY.
 */
export async function runPurgeDeleted(
  options: PurgeDeletedOptions
): Promise<Result<PurgeDeletedResult, DatabaseUnavailable>> {
  const { repositories, storage, rawBucket, publicBucket, thresholdMs, logger } = options;

  let purgedVideosCount = 0;
  let purgedGenerationsCount = 0;

  // 1. Soft-deleted videos purge (AC 4)
  const softDeletedVideos = await repositories.videos.scan({
    status: 'DELETED',
    idleFor: { since: 'deletedAt', ms: thresholdMs },
  });
  if (isErr(softDeletedVideos)) return softDeletedVideos;

  for (const video of softDeletedVideos.value) {
    logger?.info({ videoId: video.id }, 'Purging objects and hard-deleting soft-deleted video');

    // (a) Raw objects. A leftover raw object costs storage, not correctness, so a failure here is
    // dropped and the next run picks it up.
    if (video.sourceKey) await storage.deleteObject(rawBucket, video.sourceKey);
    await storage.purgePrefix(rawBucket, `raw/${video.id}/`);

    // (b) Public objects have to be gone before the row is, or the video stops being reachable
    // while its segments are still served. A failure leaves the row for the next run.
    const purged = await storage.purgePrefix(publicBucket, `videos/${video.id}/`);
    if (isErr(purged)) {
      logger?.warn(
        { videoId: video.id, storage: purged.error.operation },
        'Public objects not purged; the video row is kept for the next run'
      );
      continue;
    }

    // (c) Hard-delete video row only if storage purge succeeded
    const deleted = await repositories.videos.hardDelete(video.id);
    if (isErr(deleted)) return deleted;
    if (deleted.value) {
      purgedVideosCount += 1;
      logger?.info({ videoId: video.id }, 'Hard-deleted video row from database');
    }
  }

  // 2. Old generations purge for reprocessed videos (AC 5)
  const readyVideosWithOldGen = await repositories.videos.scan({
    status: 'READY',
    minGeneration: 2,
    without: { type: 'event', event: 'video.generation_purged', forCurrentGeneration: true },
  });
  if (isErr(readyVideosWithOldGen)) return readyVideosWithOldGen;

  for (const video of readyVideosWithOldGen.value) {
    const currentGen = video.generation;

    for (let oldGen = 1; oldGen < currentGen; oldGen += 1) {
      const deletedCount = unwrapOr(
        await storage.purgePrefix(publicBucket, `videos/${video.id}/hls/g${oldGen}/`),
        0
      );

      // Generation 1 predates the g1 prefix, so its legacy layout is swept too.
      if (oldGen === 1) {
        await storage.deleteObject(publicBucket, `videos/${video.id}/hls/master.m3u8`);
        for (const rend of ['1080p', '720p', '480p']) {
          await storage.purgePrefix(publicBucket, `videos/${video.id}/hls/${rend}/`);
        }
      }

      purgedGenerationsCount += 1;
      logger?.info(
        { videoId: video.id, oldGen, currentGen, deletedCount },
        'Purged old generation prefix'
      );
    }

    // Record audit event to prevent redundant hourly purges & starvation (Ticket 17 AC 5)
    const recorded = await repositories.events.create({
      videoId: video.id,
      type: 'video.generation_purged',
      payload: { generation: currentGen, purgedAt: new Date().toISOString() },
    });
    if (isErr(recorded)) return recorded;
  }

  // 3. Prune published outbox rows older than 7 days (Ticket 30 AC 3)
  const prunedOutboxCount = unwrapOr(await repositories.outbox.prune(7), 0);
  if (prunedOutboxCount > 0) {
    logger?.info({ prunedOutboxCount }, 'Pruned published outbox rows older than 7 days');
  }

  return ok({ purgedVideosCount, purgedGenerationsCount });
}

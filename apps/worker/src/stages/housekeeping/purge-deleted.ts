import type { Repositories, StorageClient } from '@vp/core/ports';
import type { Logger } from '@vp/observability';

export interface PurgeDeletedOptions {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket?: string;
  publicBucket?: string;
  thresholdMs?: number;
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
export async function runPurgeDeleted(options: PurgeDeletedOptions): Promise<PurgeDeletedResult> {
  const {
    repositories,
    storage,
    rawBucket = process.env['STORAGE_RAW_BUCKET'] ?? 'raw',
    publicBucket = process.env['STORAGE_PUBLIC_BUCKET'] ?? 'public',
    thresholdMs = process.env['PURGE_DELETED_THRESHOLD_MS']
      ? Number.parseInt(process.env['PURGE_DELETED_THRESHOLD_MS'], 10)
      : 60 * 60 * 1000,
    logger,
  } = options;

  let purgedVideosCount = 0;
  let purgedGenerationsCount = 0;

  // 1. Soft-deleted videos purge (AC 4)
  const softDeletedVideos = await repositories.videos.findSoftDeleted(thresholdMs);
  for (const video of softDeletedVideos) {
    logger?.info({ videoId: video.id }, 'Purging objects and hard-deleting soft-deleted video');

    try {
      // (a) Purge raw objects
      if (video.sourceKey) {
        await storage.deleteObject(rawBucket, video.sourceKey).catch(() => {});
      }
      await storage.purgePrefix(rawBucket, `raw/${video.id}/`).catch(() => {});

      // (b) Purge public objects (paginated delete)
      await storage.purgePrefix(publicBucket, `videos/${video.id}/`);

      // (c) Hard-delete video row only if storage purge succeeded
      const deleted = await repositories.videos.hardDelete(video.id);
      if (deleted) {
        purgedVideosCount += 1;
        logger?.info({ videoId: video.id }, 'Hard-deleted video row from database');
      }
    } catch (err: unknown) {
      logger?.warn(
        { videoId: video.id, err: (err as Error).message },
        'Failed to purge storage objects for soft-deleted video; will retry on next run'
      );
    }
  }

  // 2. Old generations purge for reprocessed videos (AC 5)
  const readyVideosWithOldGen = await repositories.videos.findReadyWithOldGenerations();
  for (const video of readyVideosWithOldGen) {
    const currentGen = video.generation || 1;
    if (currentGen <= 1) continue;

    for (let oldGen = 1; oldGen < currentGen; oldGen += 1) {
      const oldGenPrefix = `videos/${video.id}/hls/g${oldGen}/`;
      const deletedCount = await storage.purgePrefix(publicBucket, oldGenPrefix);

      // If generation 1 was written without g1 prefix in earlier versions:
      if (oldGen === 1) {
        // Also delete legacy non-prefixed master and renditions if present
        await storage
          .deleteObject(publicBucket, `videos/${video.id}/hls/master.m3u8`)
          .catch(() => {});
        for (const rend of ['1080p', '720p', '480p']) {
          await storage
            .purgePrefix(publicBucket, `videos/${video.id}/hls/${rend}/`)
            .catch(() => {});
        }
      }

      purgedGenerationsCount += 1;
      logger?.info(
        { videoId: video.id, oldGen, currentGen, deletedCount },
        'Purged old generation prefix'
      );
    }

    // Record audit event to prevent redundant hourly purges & starvation (Ticket 17 AC 5)
    await repositories.events.create({
      videoId: video.id,
      type: 'video.generation_purged',
      payload: { generation: currentGen, purgedAt: new Date().toISOString() },
    });
  }

  // 3. Prune published outbox rows older than 7 days (Ticket 30 AC 3)
  try {
    const prunedOutboxCount = await repositories.outbox.prune(7);
    if (prunedOutboxCount > 0) {
      logger?.info({ prunedOutboxCount }, 'Pruned published outbox rows older than 7 days');
    }
  } catch (err: unknown) {
    logger?.warn({ err: (err as Error).message }, 'Failed to prune published outbox rows');
  }

  return { purgedVideosCount, purgedGenerationsCount };
}

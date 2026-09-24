import type { StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable, StorageUnavailable } from '@vp/errors';
import { RENDITIONS } from '@vp/job-contracts';
import type { Logger } from '@vp/observability';
import { type Result, ignore, isErr, ok, unwrapOr } from '@vp/result';
import {
  masterPlaylistKey,
  rawPrefix,
  renditionPrefix,
  generationPrefix,
  videoPrefix,
} from '@vp/storage';

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
 * Purges soft-deleted videos past the threshold, then the prefixes of every generation older than
 * a READY one (SDD §9.8, §7). A generation is recorded as purged only once every prefix is gone.
 */
export async function runPurgeDeleted(
  options: PurgeDeletedOptions
): Promise<Result<PurgeDeletedResult, DatabaseUnavailable>> {
  const { repositories, storage, rawBucket, publicBucket, thresholdMs, logger } = options;

  let purgedVideosCount = 0;
  let purgedGenerationsCount = 0;

  const softDeletedVideos = await repositories.videos.scan({
    status: 'DELETED',
    idleFor: { since: 'deletedAt', ms: thresholdMs },
  });
  if (isErr(softDeletedVideos)) return softDeletedVideos;

  for (const video of softDeletedVideos.value) {
    logger?.info({ videoId: video.id }, 'Purging objects and hard-deleting soft-deleted video');

    if (video.sourceKey) {
      ignore(
        await storage.deleteObject(rawBucket, video.sourceKey),
        'a leftover raw object costs storage, and the bucket lifecycle rule expires it'
      );
    }
    ignore(
      await storage.purgePrefix(rawBucket, rawPrefix(video.id)),
      'a leftover raw object costs storage, and the bucket lifecycle rule expires it'
    );

    // Public objects go before the row, or segments stay served for a video nobody can reach.
    const purged = await storage.purgePrefix(publicBucket, videoPrefix(video.id));
    if (isErr(purged)) {
      logger?.warn(
        { videoId: video.id, storage: purged.error.operation },
        'Public objects not purged; the video row is kept for the next run'
      );
      continue;
    }

    const deleted = await repositories.videos.hardDelete(video.id);
    if (isErr(deleted)) return deleted;
    if (deleted.value) {
      purgedVideosCount += 1;
      logger?.info({ videoId: video.id }, 'Hard-deleted video row from database');
    }
  }

  const readyVideosWithOldGen = await repositories.videos.scan({
    status: 'READY',
    minGeneration: 2,
    without: { type: 'event', event: 'video.generation_purged', forCurrentGeneration: true },
  });
  if (isErr(readyVideosWithOldGen)) return readyVideosWithOldGen;

  for (const video of readyVideosWithOldGen.value) {
    const purged = await purgeOldGenerations(storage, publicBucket, video.id, video.generation);
    if (isErr(purged)) {
      logger?.warn(
        { videoId: video.id, storage: purged.error.operation },
        'Old generations not purged; the video is kept for the next run'
      );
      continue;
    }

    purgedGenerationsCount += video.generation - 1;
    logger?.info(
      { videoId: video.id, currentGen: video.generation },
      'Purged old generation prefixes'
    );

    const recorded = await repositories.events.create({
      videoId: video.id,
      type: 'video.generation_purged',
      payload: { generation: video.generation, purgedAt: new Date().toISOString() },
    });
    if (isErr(recorded)) return recorded;
  }

  const prunedOutboxCount = unwrapOr(await repositories.outbox.prune(7), 0);
  if (prunedOutboxCount > 0) {
    logger?.info({ prunedOutboxCount }, 'Pruned published outbox rows older than 7 days');
  }

  return ok({ purgedVideosCount, purgedGenerationsCount });
}

/** Generation 1 writes into `hls/` itself, whose prefix holds every later generation too. */
async function purgeOldGenerations(
  storage: StorageClient,
  bucket: string,
  videoId: string,
  currentGeneration: number
): Promise<Result<void, StorageUnavailable>> {
  for (let generation = 2; generation < currentGeneration; generation += 1) {
    const purged = await storage.purgePrefix(bucket, generationPrefix(videoId, generation));
    if (isErr(purged)) return purged;
  }

  const firstMaster = await storage.deleteObject(bucket, masterPlaylistKey(videoId));
  if (isErr(firstMaster)) return firstMaster;
  for (const rendition of RENDITIONS) {
    const purged = await storage.purgePrefix(bucket, renditionPrefix(videoId, rendition));
    if (isErr(purged)) return purged;
  }
  return ok();
}

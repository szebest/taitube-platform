import type { StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable, StorageUnavailable } from '@vp/errors';
import { RENDITIONS } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { type Result, ignore, isErr, ok, unwrapOr } from '@vp/result';
import {
  captionsTmpPrefix,
  evidencePrefix,
  livePrefix,
  masterPlaylistKey,
  rawPrefix,
  renditionPrefix,
  reprocessPrefixesBefore,
  videoPrefix,
} from '@vp/storage';

export interface PurgeDeletedOptions {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket: string;
  publicBucket: string;
  thresholdMs: number;
  scanLimit: number;
  outboxRetentionDays: number;
  userEventRetentionDays: number;
  notificationRetentionDays: number;
  logger?: Logger;
}

export interface PurgeDeletedResult {
  purgedVideosCount: number;
  purgedGenerationsCount: number;
}

/**
 * Purges soft-deleted videos past the threshold, then the prefixes of every generation older than
 * a READY one (SDD §9.8, §7). A generation is recorded as purged only once every prefix is gone.
 * Published outbox rows, user events and notifications past their retention go last (ADR-16, ADR-27).
 */
export async function runPurgeDeleted(
  options: PurgeDeletedOptions
): Promise<Result<PurgeDeletedResult, DatabaseUnavailable>> {
  const { repositories, storage, rawBucket, publicBucket, thresholdMs, scanLimit, logger } =
    options;
  const { outboxRetentionDays, userEventRetentionDays, notificationRetentionDays } = options;

  let purgedVideosCount = 0;
  let purgedGenerationsCount = 0;

  const softDeletedVideos = await repositories.videos.scan({
    status: 'DELETED',
    idleFor: { since: 'deletedAt', ms: thresholdMs },
    limit: scanLimit,
  });
  if (isErr(softDeletedVideos)) return softDeletedVideos;

  for (const video of softDeletedVideos.value) {
    logger?.info({ videoId: video.id }, 'purging objects and hard-deleting soft-deleted video');

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
    ignore(
      await storage.purgePrefix(rawBucket, captionsTmpPrefix(video.id)),
      'a leftover captions window costs storage, and the bucket lifecycle rule expires it'
    );

    ignore(
      await storage.purgePrefix(rawBucket, evidencePrefix(video.id)),
      'a leftover evidence frame costs storage, and the housekeeping that closes a case removes it'
    );

    const broadcast = await repositories.liveStreams.findByVideoId(video.id);
    if (isErr(broadcast)) return broadcast;
    const publicPrefixes = [
      videoPrefix(video.id),
      ...(broadcast.value ? [livePrefix(broadcast.value.id)] : []),
    ];

    // Public objects go before the row, or segments stay served for a video nobody can reach.
    const purged = await purgeEvery(storage, publicBucket, publicPrefixes);
    if (isErr(purged)) {
      logger?.warn(
        { videoId: video.id, storage: purged.error.operation },
        'public objects not purged; the video row is kept for the next run'
      );
      continue;
    }

    const fingerprints = await repositories.fingerprints.deleteForVideo(video.id);
    if (isErr(fingerprints)) return fingerprints;

    const deleted = await repositories.videos.hardDelete(video.id);
    if (isErr(deleted)) return deleted;
    if (deleted.value) {
      purgedVideosCount += 1;
      logger?.info({ videoId: video.id }, 'hard-deleted video row from database');
    }
  }

  const readyVideosWithOldGen = await repositories.videos.scan({
    status: 'READY',
    minGeneration: 2,
    without: { type: 'event', event: 'video.generation_purged', forCurrentGeneration: true },
    limit: scanLimit,
  });
  if (isErr(readyVideosWithOldGen)) return readyVideosWithOldGen;

  for (const video of readyVideosWithOldGen.value) {
    const purged = await purgeOldGenerations(storage, publicBucket, video.id, video.generation);
    if (isErr(purged)) {
      logger?.warn(
        { videoId: video.id, storage: purged.error.operation },
        'old generations not purged; the video is kept for the next run'
      );
      continue;
    }

    purgedGenerationsCount += video.generation - 1;
    logger?.info(
      { videoId: video.id, currentGen: video.generation },
      'purged old generation prefixes'
    );

    const recorded = await repositories.events.create({
      videoId: video.id,
      type: 'video.generation_purged',
      payload: { generation: video.generation, purgedAt: new Date().toISOString() },
    });
    if (isErr(recorded)) return recorded;
  }

  const prunedOutboxCount = unwrapOr(await repositories.outbox.prune(outboxRetentionDays), 0);
  const prunedUserEventCount = unwrapOr(
    await repositories.userEvents.prune(userEventRetentionDays),
    0
  );
  const prunedNotificationCount = unwrapOr(
    await repositories.notifications.prune(notificationRetentionDays),
    0
  );
  if (prunedOutboxCount + prunedUserEventCount + prunedNotificationCount > 0) {
    logger?.info(
      { prunedOutboxCount, prunedUserEventCount, prunedNotificationCount },
      'pruned rows past their retention'
    );
  }

  return ok({ purgedVideosCount, purgedGenerationsCount });
}

/** Purges each prefix in turn, stopping at the first that fails so the caller can retry them all. */
async function purgeEvery(
  storage: StorageClient,
  bucket: string,
  prefixes: readonly string[]
): Promise<Result<void, StorageUnavailable>> {
  for (const prefix of prefixes) {
    const purged = await storage.purgePrefix(bucket, prefix);
    if (isErr(purged)) return purged;
  }
  return ok();
}

/** Generation 1 writes into `hls/` itself, whose prefix holds every later generation too. */
async function purgeOldGenerations(
  storage: StorageClient,
  bucket: string,
  videoId: string,
  currentGeneration: number
): Promise<Result<void, StorageUnavailable>> {
  const older = await purgeEvery(
    storage,
    bucket,
    reprocessPrefixesBefore(videoId, currentGeneration)
  );
  if (isErr(older)) return older;

  const firstMaster = await storage.deleteObject(bucket, masterPlaylistKey(videoId));
  if (isErr(firstMaster)) return firstMaster;
  return purgeEvery(
    storage,
    bucket,
    RENDITIONS.map((rendition) => renditionPrefix(videoId, rendition))
  );
}

import type { StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { MS_PER_DAY } from '@vp/domain/time';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Logger } from '@vp/logger';
import { type Result, isErr, ok } from '@vp/result';
import { rawPrefix } from '@vp/storage';

export interface ExpireRawOptions {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket: string;
  retentionDays: number;
  scanLimit: number;
  logger?: Logger;
}

export interface ExpireRawResult {
  expiredCount: number;
}

/**
 * Deletes the raw source of a READY video past retention (SDD §9.8, §7). The bucket lifecycle rule
 * is the primary mechanism; this is the audit trail, so an event is written only for a source that
 * is actually gone, and a failed delete leaves the video for the next run.
 */
export async function runExpireRaw(
  options: ExpireRawOptions
): Promise<Result<ExpireRawResult, DatabaseUnavailable>> {
  const { repositories, storage, rawBucket, retentionDays, scanLimit, logger } = options;

  let expiredCount = 0;

  const expiredVideos = await repositories.videos.scan({
    status: 'READY',
    idleFor: { since: 'readyAt', ms: retentionDays * MS_PER_DAY },
    without: { type: 'event', event: 'video.raw_expired' },
    limit: scanLimit,
  });
  if (isErr(expiredVideos)) return expiredVideos;

  for (const video of expiredVideos.value) {
    if (!video.sourceKey) continue;

    logger?.info(
      { videoId: video.id, sourceKey: video.sourceKey, retentionDays },
      'expiring raw source video past retention'
    );

    const deleted = await storage.deleteObject(rawBucket, video.sourceKey);
    const purged = isErr(deleted)
      ? deleted
      : await storage.purgePrefix(rawBucket, rawPrefix(video.id));
    if (isErr(purged)) {
      logger?.warn(
        { videoId: video.id, storage: purged.error.operation },
        'raw source not removed; the video is kept for the next run'
      );
      continue;
    }

    const recorded = await repositories.events.create({
      videoId: video.id,
      type: 'video.raw_expired',
      payload: {
        sourceKey: video.sourceKey,
        retentionDays,
        expiredAt: new Date().toISOString(),
      },
    });
    if (isErr(recorded)) return recorded;

    expiredCount += 1;
  }

  return ok({ expiredCount });
}

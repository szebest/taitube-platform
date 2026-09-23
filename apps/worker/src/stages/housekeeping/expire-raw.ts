import type { StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Logger } from '@vp/observability';
import { type Result, isErr, ok } from '@vp/result';

export interface ExpireRawOptions {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket?: string;
  retentionDays?: number;
  logger?: Logger;
}

export interface ExpireRawResult {
  expiredCount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Expire raw sources past retention period (SDD §9.8, §7):
 * Delete raw/ sources of READY videos older than RAW_RETENTION_DAYS
 * (lifecycle rule is the primary mechanism; this is the audit trail).
 */
export async function runExpireRaw(
  options: ExpireRawOptions
): Promise<Result<ExpireRawResult, DatabaseUnavailable>> {
  const {
    repositories,
    storage,
    rawBucket = process.env['S3_BUCKET_RAW'] ?? 'raw',
    retentionDays = process.env['RAW_RETENTION_DAYS']
      ? Number.parseInt(process.env['RAW_RETENTION_DAYS'], 10)
      : 7,
    logger,
  } = options;

  let expiredCount = 0;

  const expiredVideos = await repositories.videos.scan({
    status: 'READY',
    idleFor: { since: 'readyAt', ms: retentionDays * DAY_MS },
    without: { event: 'video.raw_expired' },
  });
  if (isErr(expiredVideos)) return expiredVideos;

  for (const video of expiredVideos.value) {
    if (video.sourceKey) {
      logger?.info(
        { videoId: video.id, sourceKey: video.sourceKey, retentionDays },
        'Expiring raw source video past retention'
      );

      await storage.deleteObject(rawBucket, video.sourceKey).catch(() => {});
      await storage.purgePrefix(rawBucket, `raw/${video.id}/`).catch(() => {});

      await repositories.events.create({
        videoId: video.id,
        type: 'video.raw_expired',
        payload: {
          sourceKey: video.sourceKey,
          retentionDays,
          expiredAt: new Date().toISOString(),
        },
      });

      expiredCount += 1;
    }
  }

  return ok({ expiredCount });
}

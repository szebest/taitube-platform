import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { runFfmpegThumbnail } from '@vp/ffmpeg';
import type { ThumbnailJob, ThumbnailResult } from '@vp/job-contracts';
import { type Logger, getMetrics } from '@vp/observability';
import {
  getHeaderMapping,
  posterKey as getPosterKey,
  spriteKey as getSpriteKey,
  spriteVttKey as getSpriteVttKey,
} from '@vp/storage';
import { uuidv7 } from 'uuidv7';
import { getHeartbeatPath } from '../config';
import { validateJobId } from '../registry';

export interface ThumbnailProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket?: string;
  publicBucket?: string;
  workerId?: string;
  logger: Logger;
  heartbeatPath?: string;
  spriteIntervalSec?: number;
}

export function createThumbnailProcessor(deps: ThumbnailProcessorDeps) {
  const {
    repositories,
    storage,
    rawBucket = process.env['STORAGE_RAW_BUCKET'] || 'raw',
    publicBucket = process.env['STORAGE_PUBLIC_BUCKET'] || 'public',
    workerId = `worker-${process.pid}`,
    logger,
    heartbeatPath = getHeartbeatPath(),
    spriteIntervalSec,
  } = deps;

  return async function processThumbnailJob(job: QueueJob<ThumbnailJob>): Promise<ThumbnailResult> {
    validateJobId(job.id || '');

    const { videoId, sourceKey, durationMs, forceFailure } = job.data;
    const log = logger.child({
      videoId,
      jobId: job.id,
      stage: 'thumbnail',
      attempt: (job.attemptsMade ?? 0) + 1,
    });

    log.info({ sourceKey, durationMs }, 'Thumbnail job started');

    // Update heartbeat file for container liveness (SDD §9.4, AC 20)
    await fs.writeFile(heartbeatPath, new Date().toISOString()).catch(() => {});

    // Claim processing step with fresh fencing token (SDD §5.3, §9.5, AC 20)
    const lockToken = uuidv7();
    const claim = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'thumbnail',
      rendition: '-',
      jobId: job.id || '',
      attempt: (job.attemptsMade ?? 0) + 1,
      workerId,
      lockToken,
    });

    if (claim.fenced) {
      log.warn({ lockToken }, 'Thumbnail step already completed; fenced out');
      return {
        posterKey: getPosterKey(videoId),
        spriteKey: getSpriteKey(videoId),
        spriteVttKey: getSpriteVttKey(videoId),
      };
    }

    await repositories.steps.heartbeat(lockToken);

    // Forced failure check for test verification (AC 3)
    const shouldFail = forceFailure || process.env['FORCE_THUMBNAIL_FAILURE'] === 'true';
    if (shouldFail) {
      const permErr = new PermanentError(
        ErrorCodes.FFMPEG_FAILED,
        'Forced thumbnail failure for testing'
      );
      log.warn({ errorCode: permErr.code }, 'Forced thumbnail failure requested');
      await repositories.steps.fail({
        videoId,
        step: 'thumbnail',
        rendition: '-',
        lockToken,
        errorCode: permErr.code,
        errorMessage: permErr.message,
      });
      throw permErr;
    }

    // Per-job temp directory with guaranteed cleanup on every exit path
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vp-thumb-${videoId}-`));

    try {
      // 1. Download source from S3
      const localSourcePath = path.join(tmpDir, path.basename(sourceKey));
      const downloaded = await storage.downloadObject(rawBucket, sourceKey, localSourcePath);

      if (!downloaded) {
        const errorMsg = `Source object not found in storage at ${sourceKey}`;
        log.error({ sourceKey }, errorMsg);
        await repositories.steps.fail({
          videoId,
          step: 'thumbnail',
          rendition: '-',
          lockToken,
          errorCode: ErrorCodes.SOURCE_MISSING,
          errorMessage: errorMsg,
        });
        throw new PermanentError(ErrorCodes.SOURCE_MISSING, errorMsg);
      }

      const head = await storage.headObject(rawBucket, sourceKey);
      if (head?.contentLength) {
        getMetrics().workerTmpBytes.set({ stage: 'thumbnail' }, head.contentLength);
      }

      // 2. Generate poster, sprite, and WebVTT using FFmpeg
      const intervalSec =
        spriteIntervalSec ?? Number(process.env['SPRITE_INTERVAL_SECONDS'] || '5');

      let result: Awaited<ReturnType<typeof runFfmpegThumbnail>>;
      try {
        result = await runFfmpegThumbnail({
          sourcePath: localSourcePath,
          outputDir: tmpDir,
          durationMs,
          intervalSec,
        });
        getMetrics().ffmpegExitTotal.inc({ stage: 'thumbnail', code: '0' });
      } catch (thumbErr) {
        getMetrics().ffmpegExitTotal.inc({ stage: 'thumbnail', code: '1' });
        throw thumbErr;
      }

      // 3. Upload generated files to public storage (SDD §7)
      const posterKey = getPosterKey(videoId);
      const spriteKey = getSpriteKey(videoId);
      const spriteVttKey = getSpriteVttKey(videoId);

      const posterBuffer = await fs.readFile(result.posterPath);
      const spriteBuffer = await fs.readFile(result.spritePath);
      const vttContent = await fs.readFile(result.vttPath, 'utf-8');

      const posterHeaders = getHeaderMapping('poster.jpg');
      await storage.uploadObject({
        bucket: publicBucket,
        key: posterKey,
        body: posterBuffer,
        contentType: posterHeaders.contentType,
        cacheControl: posterHeaders.cacheControl,
      });

      const spriteHeaders = getHeaderMapping('sprite.jpg');
      await storage.uploadObject({
        bucket: publicBucket,
        key: spriteKey,
        body: spriteBuffer,
        contentType: spriteHeaders.contentType,
        cacheControl: spriteHeaders.cacheControl,
      });

      const vttHeaders = getHeaderMapping('sprite.vtt');
      await storage.uploadObject({
        bucket: publicBucket,
        key: spriteVttKey,
        body: vttContent,
        contentType: vttHeaders.contentType,
        cacheControl: vttHeaders.cacheControl,
      });

      log.info({ posterKey, spriteKey, spriteVttKey }, 'Uploaded thumbnail assets to storage');

      // 4. Complete processing step with fencing token (SDD §5.3, §9.5, AC 20)
      const comp = await repositories.steps.complete({
        videoId,
        step: 'thumbnail',
        rendition: '-',
        lockToken,
        result: { posterKey, spriteKey, spriteVttKey },
      });

      if (comp.fenced) {
        log.warn(
          { lockToken, event: 'FENCED_OUT' },
          'Fenced out on thumbnail completion; discarding update'
        );
        return {
          posterKey,
          spriteKey,
          spriteVttKey,
        };
      }

      // 5. Update video row with posterKey and spriteKey (AC 1, AC 3) only if not fenced out
      await repositories.videos.transition({
        videoId,
        from: 'PROCESSING',
        to: 'PROCESSING',
        eventType: 'thumbnail.completed',
        eventPayload: { posterKey, spriteKey, spriteVttKey },
        patch: { posterKey, spriteKey },
      });

      return {
        posterKey,
        spriteKey,
        spriteVttKey,
      };
    } catch (err: unknown) {
      const isPermanent = err instanceof PermanentError;
      const errorCode = isPermanent
        ? (err as PermanentError).code
        : (err as { code?: string })?.code || ErrorCodes.INTERNAL;
      const errorMessage = (err as Error).message || 'Thumbnail generation failed';

      log.error({ errorCode, errorMessage }, 'Thumbnail job failed');

      await repositories.steps.fail({
        videoId,
        step: 'thumbnail',
        rendition: '-',
        lockToken,
        errorCode,
        errorMessage,
      });

      throw err;
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      getMetrics().workerTmpBytes.set({ stage: 'thumbnail' }, 0);
    }
  };
}

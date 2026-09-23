import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type MediaFailure,
  type StorageUnavailable,
  mediaFailure,
  mediaFailureFrom,
} from '@vp/errors';
import { runFfmpegThumbnail } from '@vp/ffmpeg';
import type { ThumbnailJob, ThumbnailResult } from '@vp/job-contracts';
import { type Logger, getMetrics } from '@vp/observability';
import { type Result, err, fromPromise, isErr, map, ok, unwrapOr } from '@vp/result';
import {
  getHeaderMapping,
  posterKey as getPosterKey,
  spriteKey as getSpriteKey,
  spriteVttKey as getSpriteVttKey,
} from '@vp/storage';
import { uuidv7 } from 'uuidv7';

import { validateJobId } from '../job-identity';

export interface ThumbnailProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket: string;
  publicBucket: string;
  workerId?: string;
  logger: Logger;
  heartbeatPath: string;
  spriteIntervalSec: number;
}

export type ThumbnailStageFailure = MediaFailure | StorageUnavailable | DatabaseUnavailable;

export function createThumbnailProcessor(deps: ThumbnailProcessorDeps) {
  const {
    repositories,
    storage,
    rawBucket,
    publicBucket,
    workerId = `worker-${process.pid}`,
    logger,
    heartbeatPath,
    spriteIntervalSec,
  } = deps;

  return async function processThumbnailJob(
    job: QueueJob<ThumbnailJob>
  ): Promise<Result<ThumbnailResult, ThumbnailStageFailure>> {
    validateJobId(job.id || '');

    const { videoId, sourceKey, durationMs } = job.data;
    const attempt = (job.attemptsMade ?? 0) + 1;
    const log = logger.child({ videoId, jobId: job.id, stage: 'thumbnail', attempt });

    const keys: ThumbnailResult = {
      posterKey: getPosterKey(videoId),
      spriteKey: getSpriteKey(videoId),
      spriteVttKey: getSpriteVttKey(videoId),
    };

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
      attempt,
      workerId,
      lockToken,
    });
    if (isErr(claim)) return claim;

    if (claim.value.fenced) {
      log.warn({ lockToken }, 'Thumbnail step already completed; fenced out');
      return ok(keys);
    }

    const beat = await repositories.steps.heartbeat(lockToken);
    if (isErr(beat)) return beat;

    /** One place records how a thumbnail ended, so every exit reports the same way. */
    const failThumbnail = async (
      failure: MediaFailure
    ): Promise<Result<never, ThumbnailStageFailure>> => {
      log.error({ errorCode: failure.code, errorMessage: failure.message }, 'Thumbnail job failed');
      const recorded = await repositories.steps.fail({
        videoId,
        step: 'thumbnail',
        rendition: '-',
        lockToken,
        errorCode: failure.code,
        errorMessage: failure.message,
      });
      return isErr(recorded) ? recorded : err(failure);
    };

    // Per-job temp directory with guaranteed cleanup on every exit path
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vp-thumb-${videoId}-`));

    try {
      // 1. Download source from S3
      const localSourcePath = path.join(tmpDir, path.basename(sourceKey));
      const downloaded = await storage.downloadObject(rawBucket, sourceKey, localSourcePath);
      if (isErr(downloaded)) return downloaded;

      if (!downloaded.value) {
        return failThumbnail(
          mediaFailure(
            'thumbnail',
            ErrorCodes.SOURCE_MISSING,
            `Source object not found in storage at ${sourceKey}`
          )
        );
      }

      const head = unwrapOr(await storage.headObject(rawBucket, sourceKey), null);
      if (head?.contentLength) {
        getMetrics().workerTmpBytes.set({ stage: 'thumbnail' }, head.contentLength);
      }

      // 2. Generate poster, sprite, and WebVTT using FFmpeg
      const generated = await fromPromise(
        () =>
          runFfmpegThumbnail({
            sourcePath: localSourcePath,
            outputDir: tmpDir,
            durationMs,
            intervalSec: spriteIntervalSec,
          }),
        (cause) => mediaFailureFrom('thumbnail', cause)
      );

      if (isErr(generated)) {
        getMetrics().ffmpegExitTotal.inc({ stage: 'thumbnail', code: '1' });
        return failThumbnail(generated.error);
      }
      getMetrics().ffmpegExitTotal.inc({ stage: 'thumbnail', code: '0' });

      // 3. Upload generated files to public storage (SDD §7)
      const uploaded = await uploadAssets(storage, publicBucket, keys, generated.value);
      if (isErr(uploaded)) return uploaded;

      log.info(keys, 'Uploaded thumbnail assets to storage');

      // 4. Complete processing step with fencing token (SDD §5.3, §9.5, AC 20)
      const comp = await repositories.steps.complete({
        videoId,
        step: 'thumbnail',
        rendition: '-',
        lockToken,
        result: { ...keys },
      });
      if (isErr(comp)) return comp;

      if (comp.value.fenced) {
        log.warn(
          { lockToken, event: 'FENCED_OUT' },
          'Fenced out on thumbnail completion; discarding update'
        );
        return ok(keys);
      }

      // 5. Update video row with posterKey and spriteKey (AC 1, AC 3) only if not fenced out
      return map(
        await repositories.videos.transition({
          videoId,
          from: 'PROCESSING',
          to: 'PROCESSING',
          eventType: 'thumbnail.completed',
          eventPayload: { ...keys },
          patch: { posterKey: keys.posterKey, spriteKey: keys.spriteKey },
        }),
        () => keys
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      getMetrics().workerTmpBytes.set({ stage: 'thumbnail' }, 0);
    }
  };
}

interface GeneratedThumbnails {
  posterPath: string;
  spritePath: string;
  vttPath: string;
}

async function uploadAssets(
  storage: StorageClient,
  bucket: string,
  keys: ThumbnailResult,
  generated: GeneratedThumbnails
): Promise<Result<void, StorageUnavailable>> {
  const assets = [
    { key: keys.posterKey, name: 'poster.jpg', body: await fs.readFile(generated.posterPath) },
    { key: keys.spriteKey, name: 'sprite.jpg', body: await fs.readFile(generated.spritePath) },
    {
      key: keys.spriteVttKey,
      name: 'sprite.vtt',
      body: await fs.readFile(generated.vttPath, 'utf-8'),
    },
  ];

  for (const asset of assets) {
    const headers = getHeaderMapping(asset.name);
    const uploaded = await storage.uploadObject({
      bucket,
      key: asset.key,
      body: asset.body,
      contentType: headers.contentType,
      cacheControl: headers.cacheControl,
    });
    if (isErr(uploaded)) return uploaded;
  }

  return ok();
}

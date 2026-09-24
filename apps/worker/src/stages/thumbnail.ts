import * as fs from 'node:fs/promises';
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
import type { MediaTools, SpriteLayout } from '@vp/ffmpeg';
import type { ThumbnailJob, ThumbnailResult } from '@vp/job-contracts';
import type { PipelineMetrics } from '@vp/observability';
import type { Logger } from '@vp/logger';
import { type Result, err, fromPromise, isErr, map, ok, unwrapOr } from '@vp/result';
import {
  getHeaderMapping,
  posterKey as getPosterKey,
  spriteKey as getSpriteKey,
  spriteVttKey as getSpriteVttKey,
} from '@vp/storage';
import { uuidv7 } from 'uuidv7';
import { createScratchDir, removeScratchDir } from './scratch-dir';

export interface ThumbnailProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  media: MediaTools;
  metrics: PipelineMetrics;
  rawBucket: string;
  publicBucket: string;
  workerId: string;
  logger: Logger;
  tmpDir: string;
  ffmpegPath: string;
  sprite: SpriteLayout;
  ffmpegProcess: { killGraceMs: number; stderrTailLines: number; thumbnailTimeoutMs: number };
}

export type ThumbnailStageFailure = MediaFailure | StorageUnavailable | DatabaseUnavailable;

export function createThumbnailProcessor(deps: ThumbnailProcessorDeps) {
  const {
    repositories,
    storage,
    media,
    metrics,
    rawBucket,
    publicBucket,
    workerId,
    logger,
    tmpDir: tmpRoot,
    ffmpegPath,
    sprite,
    ffmpegProcess,
  } = deps;

  return async function processThumbnailJob(
    job: QueueJob<ThumbnailJob>
  ): Promise<Result<ThumbnailResult, ThumbnailStageFailure>> {
    const { videoId, sourceKey, durationMs } = job.data;
    const attempt = (job.attemptsMade ?? 0) + 1;
    const log = logger.child({ videoId, jobId: job.id, stage: 'thumbnail', attempt });

    const keys: ThumbnailResult = {
      type: 'thumbnail',
      posterKey: getPosterKey(videoId),
      spriteKey: getSpriteKey(videoId),
      spriteVttKey: getSpriteVttKey(videoId),
    };

    log.info({ sourceKey, durationMs }, 'thumbnail job started');

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
      log.warn({ lockToken }, 'thumbnail step already completed; fenced out');
      return ok(keys);
    }

    const beat = await repositories.steps.heartbeat(lockToken);
    if (isErr(beat)) return beat;

    /** One place records how a thumbnail ended, so every exit reports the same way. */
    const failThumbnail = async (
      failure: MediaFailure
    ): Promise<Result<never, ThumbnailStageFailure>> => {
      log.error({ errorCode: failure.code, errorMessage: failure.message }, 'thumbnail job failed');
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

    const tmpDir = await createScratchDir(tmpRoot, `vp-thumb-${videoId}-`);

    try {
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
        metrics.workerTmpBytes.set({ stage: 'thumbnail' }, head.contentLength);
      }

      const generated = await fromPromise(
        () =>
          media.thumbnail({
            ffmpegPath,
            sourcePath: localSourcePath,
            outputDir: tmpDir,
            durationMs,
            layout: sprite,
            timeoutMs: ffmpegProcess.thumbnailTimeoutMs,
            limits: ffmpegProcess,
          }),
        (cause) => mediaFailureFrom('thumbnail', cause)
      );

      if (isErr(generated)) {
        metrics.ffmpegExitTotal.inc({ stage: 'thumbnail', code: '1' });
        return failThumbnail(generated.error);
      }
      metrics.ffmpegExitTotal.inc({ stage: 'thumbnail', code: '0' });

      const uploaded = await uploadAssets(storage, publicBucket, keys, generated.value);
      if (isErr(uploaded)) return uploaded;

      log.info(keys, 'uploaded thumbnail assets to storage');

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
          'fenced out on thumbnail completion; discarding update'
        );
        return ok(keys);
      }

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
      await removeScratchDir(tmpDir);
      metrics.workerTmpBytes.set({ stage: 'thumbnail' }, 0);
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

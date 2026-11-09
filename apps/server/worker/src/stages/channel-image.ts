import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { ChannelImageUpload, ImageCrops } from '@vp/domain';
import { decideImageCrops, type DecideImageCropsFailure } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type MediaFailure,
  RETRY_CLASS,
  type StorageUnavailable,
  isInputFailure,
  mediaFailure,
  mediaFailureFrom,
} from '@vp/errors';
import { type MediaTools, defaultChannelImageVariant, planChannelImageVariants } from '@vp/ffmpeg';
import type { ChannelImageJob } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, err, fromPromise, isErr, ok } from '@vp/result';
import { channelImageUploadKey, channelImageVariantKey, getHeaderMapping } from '@vp/storage';
import { createScratchDir, removeScratchDir } from './scratch-dir';

const STAGE = 'channel-image';

export interface ChannelImageProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  media: MediaTools;
  metrics: PipelineMetrics;
  rawBucket: string;
  publicBucket: string;
  cdn: CdnBase;
  logger: Logger;
  tmpDir: string;
  ffmpegPath: string;
  ffprobePath: string;
  ffmpegProcess: { killGraceMs: number; stderrTailLines: number; thumbnailTimeoutMs: number };
}

export type ChannelImageStageFailure =
  | MediaFailure
  | DecideImageCropsFailure
  | StorageUnavailable
  | DatabaseUnavailable;

export interface ChannelImageResult {
  type: 'channel-image';
  uploadId: string;
  version: number | null;
  applied: boolean;
}

interface QueuedUpload {
  upload: ChannelImageUpload;
  version: number;
  crops: ImageCrops;
}

/** What the uploader is told; a media failure carries process output that is no business of theirs. */
function reasonOf(failure: ChannelImageStageFailure): string {
  return isInputFailure(failure)
    ? failure.message
    : 'The file could not be read as a JPEG, PNG or WebP image';
}

/**
 * Cuts every variant of a queued avatar or banner and commits the version. A file that can never
 * become one fails the upload; anything the queue can retry leaves it queued until the last attempt.
 */
export function createChannelImageProcessor(deps: ChannelImageProcessorDeps) {
  const { repositories, storage, media, metrics, rawBucket, publicBucket, cdn, logger } = deps;
  const images = repositories.channelImages;

  async function cut(
    { upload, version, crops }: QueuedUpload,
    tmpDir: string
  ): Promise<Result<ChannelImageResult, ChannelImageStageFailure>> {
    const { id, channelId, kind } = upload;
    const sourceKey = channelImageUploadKey(channelId, kind, id);
    const sourcePath = path.join(tmpDir, 'source');

    const downloaded = await storage.downloadObject(rawBucket, sourceKey, sourcePath);
    if (isErr(downloaded)) return downloaded;
    if (!downloaded.value) {
      return err(
        mediaFailure(STAGE, ErrorCodes.SOURCE_MISSING, `Upload object not found at ${sourceKey}`)
      );
    }

    const probed = await fromPromise(
      () =>
        media.probeChannelImage(sourcePath, {
          ffprobePath: deps.ffprobePath,
          timeoutMs: deps.ffmpegProcess.thumbnailTimeoutMs,
        }),
      (cause) => mediaFailureFrom(STAGE, cause, ErrorCodes.CORRUPT_CONTAINER)
    );
    if (isErr(probed)) return probed;

    const decided = decideImageCrops(crops, probed.value);
    if (isErr(decided)) return decided;

    const variants = planChannelImageVariants(decided.value);
    const rendered = await fromPromise(
      () =>
        media.channelImage({
          ffmpegPath: deps.ffmpegPath,
          sourcePath,
          outputDir: tmpDir,
          variants,
          timeoutMs: deps.ffmpegProcess.thumbnailTimeoutMs,
          limits: deps.ffmpegProcess,
        }),
      (cause) => mediaFailureFrom(STAGE, cause)
    );
    metrics.ffmpegExitTotal.inc({ stage: STAGE, code: isErr(rendered) ? '1' : '0' });
    if (isErr(rendered)) return rendered;

    for (const file of rendered.value) {
      const key = channelImageVariantKey(channelId, kind, file.name, version);
      const headers = getHeaderMapping(key);
      const uploaded = await storage.uploadObject({
        bucket: publicBucket,
        key,
        body: await fs.readFile(file.path),
        contentType: headers.contentType,
        cacheControl: headers.cacheControl,
      });
      if (isErr(uploaded)) return uploaded;
    }

    const defaultKey = channelImageVariantKey(
      channelId,
      kind,
      defaultChannelImageVariant(kind),
      version
    );
    const committed = await images.commit(id, `${cdn}/${defaultKey}`);
    if (isErr(committed)) return committed;
    return ok({
      type: STAGE,
      uploadId: id,
      version,
      applied: committed.value?.applied ?? false,
    });
  }

  return async function processChannelImageJob(
    job: QueueJob<ChannelImageJob>
  ): Promise<Result<ChannelImageResult, ChannelImageStageFailure>> {
    const { uploadId } = job.data;
    const attempt = (job.attemptsMade ?? 0) + 1;
    const log = logger.child({ uploadId, jobId: job.id, stage: STAGE, attempt });
    const lastAttempt = job.opts?.attempts !== undefined && attempt >= job.opts.attempts;

    const found = await images.findById(uploadId);
    if (isErr(found)) return found;
    const upload = found.value;
    if (!upload || upload.status !== 'queued') {
      log.info(
        { status: upload?.status ?? 'missing' },
        'channel image upload settled; nothing to do'
      );
      return ok({ type: STAGE, uploadId, version: upload?.version ?? null, applied: false });
    }

    const { crops } = upload;
    const queued =
      upload.version !== null && crops !== null ? { upload, version: upload.version, crops } : null;

    const tmpDir = await createScratchDir(deps.tmpDir, `vp-channel-image-${uploadId}-`);
    try {
      const outcome = queued
        ? await cut(queued, tmpDir)
        : err(mediaFailure(STAGE, ErrorCodes.CORRUPT_CONTAINER, 'Upload has no version or crops'));
      if (!isErr(outcome)) {
        log.info(
          { version: outcome.value.version, applied: outcome.value.applied },
          'channel image committed'
        );
        return outcome;
      }

      const failure = outcome.error;
      log.error({ err: failure }, 'channel image job failed');
      if (RETRY_CLASS[failure.code] === 'permanent' || lastAttempt) {
        const recorded = await images.fail(uploadId, reasonOf(failure));
        if (isErr(recorded)) return recorded;
      }
      return outcome;
    } finally {
      await removeScratchDir(tmpDir);
    }
  };
}

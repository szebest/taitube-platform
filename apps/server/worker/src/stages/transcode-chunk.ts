import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable, MediaFailure, StorageUnavailable } from '@vp/errors';
import type { MediaTools } from '@vp/ffmpeg';
import { CHUNKED_TRANSCODE, type TranscodeJob } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import { err, fromPromise, isErr, ok, type Result } from '@vp/result';
import { chunkKey } from '@vp/storage';
import { uuidv7 } from 'uuidv7';
import { createScratchDir, removeScratchDir } from './scratch-dir';
import type { TranscodeProcessorDeps } from './transcode';
import { stepLease } from './step-lease';
import { transcodeFailure } from './transcode-failure';
import { resolveTranscodeSource } from './transcode-source';

export interface ChunkProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  media: MediaTools;
  metrics: PipelineMetrics;
  rawBucket: string;
  workerId: string;
  logger: Logger;
  tmpDir: string;
  ffmpeg: TranscodeProcessorDeps['ffmpeg'];
}

export interface ChunkStageResult {
  type: 'chunk';
  videoId: string;
  rendition: string;
  chunkIndex: number;
  bytes: number;
}

export type ChunkStageFailure = MediaFailure | StorageUnavailable | DatabaseUnavailable;

const STEP = 'transcode-chunk';

export function createTranscodeChunkProcessor(deps: ChunkProcessorDeps) {
  const { repositories, storage, media, metrics, rawBucket, workerId, logger, ffmpeg } = deps;

  return async function processChunkJob(
    job: QueueJob<TranscodeJob>
  ): Promise<Result<ChunkStageResult, ChunkStageFailure>> {
    const { videoId, sourceKey, rendition, fps, durationMs, generation } = job.data;
    const chunkIndex = job.data.chunkIndex ?? 0;
    const attempt = (job.attemptsMade ?? 0) + 1;
    const stage = `transcode-${rendition.name}`;
    const stepRendition = `${rendition.name}--c${chunkIndex}`;
    const log = logger.child({ videoId, jobId: job.id, stage, chunkIndex, attempt });

    const skipped: ChunkStageResult = {
      type: 'chunk',
      videoId,
      rendition: rendition.name,
      chunkIndex,
      bytes: 0,
    };

    const lockToken = uuidv7();
    const claim = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: STEP,
      rendition: stepRendition,
      jobId: job.id,
      attempt,
      workerId,
      lockToken,
    });
    if (isErr(claim)) return claim;
    if (claim.value.fenced) {
      log.warn({ lockToken }, 'chunk step already completed; fenced out');
      return ok(skipped);
    }

    const failChunk = async (failure: MediaFailure): Promise<Result<never, ChunkStageFailure>> => {
      metrics.ffmpegExitTotal.inc({ stage, code: failure.code });
      const recorded = await repositories.steps.fail({
        videoId,
        step: STEP,
        rendition: stepRendition,
        lockToken,
        errorCode: failure.code,
        errorMessage: failure.message,
      });
      return isErr(recorded) ? recorded : err(failure);
    };

    const startSeconds = chunkIndex * CHUNKED_TRANSCODE.chunkSeconds;
    const durationSeconds = Math.min(
      CHUNKED_TRANSCODE.chunkSeconds,
      durationMs / 1000 - startSeconds
    );
    const tmpDir = await createScratchDir(deps.tmpDir, `vp-chunk-${videoId}-${rendition.name}-`);
    const outputPath = path.join(tmpDir, 'chunk.mp4');
    const lease = stepLease(repositories.steps, lockToken);

    try {
      const source = await resolveTranscodeSource({
        storage,
        rawBucket,
        sourceKey,
        tmpDir,
        rendition: rendition.name,
        streaming: true,
        log,
      });
      if (isErr(source)) return source;

      const encoded = await fromPromise(
        () =>
          media.transcodeChunk({
            ffmpegPath: ffmpeg.path,
            sourcePath: source.value,
            outputPath,
            rendition,
            fps,
            gopSeconds: ffmpeg.gopSeconds,
            timeoutFactor: ffmpeg.timeoutFactor,
            minTimeoutMs: ffmpeg.minTimeoutMs,
            limits: ffmpeg.limits,
            durationMs: durationSeconds * 1000,
            threads: ffmpeg.threads,
            preset: ffmpeg.preset,
            attempt,
            startSeconds,
            durationSeconds,
            signal: lease.signal,
            onProgress: () => lease.renew(),
          }),
        (cause) => transcodeFailure(rendition.name, cause)
      );
      await lease.settled();
      if (lease.lost) {
        log.warn({ lockToken }, 'step lease lost; the chunk encode was aborted');
        return ok(skipped);
      }
      if (isErr(encoded)) return failChunk(encoded.error);

      const body = await fromPromise(
        () => fs.readFile(outputPath),
        (cause) => transcodeFailure(rendition.name, cause)
      );
      if (isErr(body)) return failChunk(body.error);

      const uploaded = await storage.uploadObject({
        bucket: rawBucket,
        key: chunkKey(videoId, generation, rendition.name, chunkIndex),
        body: body.value,
        contentType: 'video/mp4',
      });
      if (isErr(uploaded)) return uploaded;

      const completed = await repositories.steps.complete({
        videoId,
        step: STEP,
        rendition: stepRendition,
        lockToken,
        result: { chunkIndex, bytes: body.value.length },
      });
      if (isErr(completed)) return completed;

      return ok({ ...skipped, bytes: body.value.length });
    } finally {
      await removeScratchDir(tmpDir);
    }
  };
}

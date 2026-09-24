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
} from '@vp/errors';
import { type FfmpegProcessLimits, type MediaTools, computeFfmpegThreads } from '@vp/ffmpeg';
import type { TranscodeJob, TranscodeResult } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, err, fromPromise, ignore, isErr, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import type { ProgressReporter, ProgressTarget } from './progress-reporter';
import { createScratchDir, removeScratchDir } from './scratch-dir';
import type { SegmentUploader, SegmentUploaderTarget } from './segment-uploader';
import { transcodeFailure } from './transcode-failure';
import { resolveTranscodeSource } from './transcode-source';

export interface TranscodeProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  media: MediaTools;
  metrics: PipelineMetrics;
  rawBucket: string;
  workerId: string;
  logger: Logger;
  tmpDir: string;
  ffmpeg: {
    path: string;
    threads: number;
    preset: string;
    gopSeconds: number;
    hlsSegmentSeconds: number;
    timeoutFactor: number;
    minTimeoutMs: number;
    limits: FfmpegProcessLimits;
  };
  progressReporter: (target: ProgressTarget) => ProgressReporter;
  segmentUploader: (target: SegmentUploaderTarget) => SegmentUploader;
}

export interface TranscodeStageResult extends TranscodeResult {
  videoId: string;
  playlistKey: string;
  processingMs: number;
}

export type TranscodeStageFailure = MediaFailure | StorageUnavailable | DatabaseUnavailable;

/**
 * Why an encode was stopped before FFmpeg finished: the lease renewal failed (retry the job) or
 * another worker holds the step now (a zombie commits nothing and steps aside).
 */
type LostLease =
  | { readonly type: 'unavailable'; readonly failure: DatabaseUnavailable }
  | { readonly type: 'fenced' };

export function createTranscodeProcessor(deps: TranscodeProcessorDeps) {
  const { repositories, storage, media, metrics, rawBucket, workerId, logger, ffmpeg } = deps;

  return async function processTranscodeJob(
    job: QueueJob<TranscodeJob>
  ): Promise<Result<TranscodeStageResult, TranscodeStageFailure>> {
    const { videoId, sourceKey, rendition, fps, durationMs, generation } = job.data;
    const attempt = (job.attemptsMade ?? 0) + 1;
    const threads = computeFfmpegThreads(ffmpeg.threads, attempt);
    const stage = `transcode-${rendition.name}`;

    const log = logger.child({
      videoId,
      jobId: job.id,
      stage,
      rendition: rendition.name,
      attempt,
      threads,
      baseThreads: ffmpeg.threads,
    });

    const startTime = Date.now();
    log.info({ sourceKey }, 'transcode attempt starting');

    const fencedOut: TranscodeStageResult = {
      type: 'transcode',
      videoId,
      rendition: rendition.name,
      playlistKey: '',
      segmentCount: 0,
      bytes: 0,
      durationMs,
      avgBitrateBps: 0,
      processingMs: 0,
    };

    const lockToken = uuidv7();
    const claim = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'transcode',
      rendition: rendition.name,
      jobId: job.id,
      attempt,
      workerId,
      lockToken,
    });
    if (isErr(claim)) return claim;

    if (claim.value.fenced) {
      log.warn({ lockToken }, 'transcode step already completed; fenced out');
      return ok(fencedOut);
    }

    const running = await repositories.renditions.update(videoId, rendition.name, {
      status: 'RUNNING',
    });
    if (isErr(running)) return running;

    const failTranscode = async (
      failure: MediaFailure
    ): Promise<Result<never, TranscodeStageFailure>> => {
      metrics.ffmpegExitTotal.inc({ stage, code: failure.code });

      const recorded = await repositories.steps.fail({
        videoId,
        step: 'transcode',
        rendition: rendition.name,
        lockToken,
        errorCode: failure.code,
        errorMessage: failure.message,
      });
      if (isErr(recorded)) return recorded;

      const marked = await repositories.renditions.update(videoId, rendition.name, {
        status: 'FAILED',
      });
      return isErr(marked) ? marked : err(failure);
    };

    const tmpDir = await createScratchDir(
      deps.tmpDir,
      `vp-transcode-${videoId}-${rendition.name}-`
    );
    const outDir = path.join(tmpDir, 'hls');
    await fs.mkdir(outDir, { recursive: true });

    const progress = deps.progressReporter({ videoId, rendition: rendition.name, logger: log });
    const lease = new AbortController();
    let lostLease: LostLease | undefined;
    let lastRenewal = 0;
    let renewal: Promise<void> = Promise.resolve();

    const renewLease = async (): Promise<void> => {
      const renewed = await repositories.steps.heartbeat(lockToken);
      if (isErr(renewed)) lostLease = { type: 'unavailable', failure: renewed.error };
      else if (!renewed.value) lostLease = { type: 'fenced' };
      if (lostLease) lease.abort();
    };

    try {
      const source = await resolveTranscodeSource({
        storage,
        rawBucket,
        sourceKey,
        tmpDir,
        rendition: rendition.name,
        streaming: job.data.streamingInput === true,
        log,
      });
      if (isErr(source)) {
        return source.error.code === ErrorCodes.SOURCE_MISSING
          ? failTranscode(source.error as MediaFailure)
          : source;
      }

      const uploader = deps.segmentUploader({
        outputDir: outDir,
        videoId,
        generation,
        rendition: rendition.name,
        logger: log,
      });
      uploader.start();

      const encoded = await fromPromise(
        async () => {
          await media.transcode({
            ffmpegPath: ffmpeg.path,
            sourcePath: source.value,
            outputDir: outDir,
            rendition,
            fps,
            gopSeconds: ffmpeg.gopSeconds,
            hlsSegmentSeconds: ffmpeg.hlsSegmentSeconds,
            timeoutFactor: ffmpeg.timeoutFactor,
            minTimeoutMs: ffmpeg.minTimeoutMs,
            limits: ffmpeg.limits,
            durationMs,
            threads,
            preset: ffmpeg.preset,
            attempt,
            signal: lease.signal,
            onProgress: ({ percent }) => {
              const now = Date.now();
              if (now - lastRenewal < 2000 && percent < 100) return;
              lastRenewal = now;
              ignore(
                fromPromise(
                  async () => job.updateProgress?.(percent),
                  (cause) => cause
                ),
                'BullMQ progress is advisory; the step lease is what fences the job'
              );
              renewal = renewLease();
              void progress.report(percent);
            },
          });
          await progress.report(100);
        },
        (cause) => transcodeFailure(rendition.name, cause)
      );

      await renewal;
      const uploadResult = await uploader.stop(encoded.ok && !lostLease);
      if (lostLease) {
        log.warn({ lockToken, lease: lostLease.type }, 'step lease lost; the encode was aborted');
        return lostLease.type === 'fenced' ? ok(fencedOut) : err(lostLease.failure);
      }
      if (isErr(encoded)) return failTranscode(encoded.error);

      if (isErr(uploadResult)) return failTranscode(uploadResult.error);
      if (!uploadResult.value) {
        return failTranscode(
          mediaFailure(stage, ErrorCodes.FFMPEG_FAILED, 'Segment upload returned no result')
        );
      }

      const { totalBytes, segmentCount, playlistKey } = uploadResult.value;
      const processingMs = Date.now() - startTime;

      log.info(
        { segmentCount, bytes: totalBytes, processingMs },
        'uploaded rendition segments and playlist to public storage'
      );

      const done = await repositories.renditions.update(videoId, rendition.name, {
        status: 'DONE',
        playlistKey,
        segmentCount,
        bytes: totalBytes,
        processingMs,
      });
      if (isErr(done)) return done;

      const comp = await repositories.steps.complete({
        videoId,
        step: 'transcode',
        rendition: rendition.name,
        lockToken,
        result: { segmentCount, bytes: totalBytes, playlistKey, processingMs },
      });
      if (isErr(comp)) return comp;

      const avgBitrateBps = durationMs > 0 ? Math.round((totalBytes * 8) / (durationMs / 1000)) : 0;

      if (durationMs > 0 && processingMs > 0) {
        metrics.transcodeRealtimeFactor.observe(
          { rendition: rendition.name, preset: 'ultrafast' },
          durationMs / processingMs
        );
      }
      if (totalBytes > 0) {
        metrics.transcodeOutputBytes.inc({ rendition: rendition.name }, totalBytes);
      }

      const outcome: TranscodeStageResult = {
        type: 'transcode',
        videoId,
        rendition: rendition.name,
        playlistKey,
        segmentCount,
        bytes: totalBytes,
        durationMs,
        avgBitrateBps,
        processingMs,
      };

      if (comp.value.fenced) {
        log.warn({ lockToken, event: 'FENCED_OUT' }, 'fenced out on transcode completion');
        return ok(outcome);
      }

      const recorded = await repositories.events.create({
        videoId,
        type: 'transcode.completed',
        payload: {
          rendition: rendition.name,
          segmentCount,
          bytes: totalBytes,
          durationMs,
          avgBitrateBps,
          processingMs,
        },
      });
      if (isErr(recorded)) return recorded;

      return ok(outcome);
    } finally {
      await removeScratchDir(tmpDir);
    }
  };
}

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CacheClient, JobQueue, QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type MediaFailure,
  type StorageUnavailable,
  mediaFailure,
} from '@vp/errors';
import { computeFfmpegThreads, runFfmpegTranscode } from '@vp/ffmpeg';
import type { TranscodeJob, TranscodeResult } from '@vp/job-contracts';
import { type Logger, type PipelineMetrics, getMetrics } from '@vp/observability';
import { type Result, err, fromPromise, isErr, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { validateJobId } from '../job-identity';
import { TranscodeProgressReporter } from './progress-reporter';
import { StreamingSegmentUploader } from './segment-uploader';
import { transcodeFailure } from './transcode-failure';
import { resolveTranscodeSource } from './transcode-source';

export interface TranscodeProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  cache?: CacheClient;
  rawBucket: string;
  publicBucket: string;
  workerId?: string;
  logger: Logger;
  metrics?: PipelineMetrics;
  heartbeatPath: string;
  ffmpeg: { threads: number; preset: string };
  getQueue?: (name: string) => JobQueue;
  streamingInput?: boolean;
}

export interface TranscodeStageResult extends TranscodeResult {
  videoId: string;
  playlistKey: string;
  processingMs: number;
}

export type TranscodeStageFailure = MediaFailure | StorageUnavailable | DatabaseUnavailable;

export function createTranscodeProcessor(deps: TranscodeProcessorDeps) {
  const {
    repositories,
    storage,
    rawBucket,
    publicBucket,
    workerId = `worker-${process.pid}`,
    logger,
    metrics: depsMetrics,
    heartbeatPath,
    ffmpeg,
    streamingInput: depsStreamingInput,
  } = deps;

  const metrics = depsMetrics ?? getMetrics();

  return async function processTranscodeJob(
    job: QueueJob<TranscodeJob>
  ): Promise<Result<TranscodeStageResult, TranscodeStageFailure>> {
    validateJobId(job.id || '');

    const { videoId, sourceKey, rendition, fps, durationMs } = job.data;
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
    log.info(
      { rendition: rendition.name, sourceKey, threads, attempt },
      `Transcode attempt ${attempt}: threads = ${threads}`
    );

    const progressReporter = new TranscodeProgressReporter({
      cache: deps.cache,
      repositories,
      videoId,
      rendition: rendition.name,
      logger: log,
    });

    // Liveness heartbeat file (AC 21)
    await fs.writeFile(heartbeatPath, new Date().toISOString()).catch(() => {});

    // 1. Claim processing step with fencing token (SDD §5.3, §9.5)
    const lockToken = uuidv7();
    const claim = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'transcode',
      rendition: rendition.name,
      jobId: job.id || '',
      attempt,
      workerId,
      lockToken,
    });
    if (isErr(claim)) return claim;

    if (claim.value.fenced) {
      log.warn({ lockToken }, 'Transcode step already completed; fenced out');
      return ok({
        videoId,
        rendition: rendition.name,
        playlistKey: '',
        segmentCount: 0,
        bytes: 0,
        durationMs,
        avgBitrateBps: 0,
        processingMs: 0,
      });
    }

    const running = await repositories.renditions.update(videoId, rendition.name, {
      status: 'RUNNING',
    });
    if (isErr(running)) return running;

    /** One place records how a transcode ended, so every exit reports the same way. */
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

    // 2. Per-job temp directory with guaranteed cleanup on every exit path (AC 21)
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `vp-transcode-${videoId}-${rendition.name}-`)
    );
    const outDir = path.join(tmpDir, 'hls');
    await fs.mkdir(outDir, { recursive: true });

    // Track temporary disk usage (worker_tmp_bytes metric)
    const srcBytes = (job.data as unknown as { sourceSizeBytes?: number }).sourceSizeBytes ?? 0;
    if (srcBytes > 0) {
      metrics.workerTmpBytes.set({ stage }, srcBytes);
    }

    let lastProgressHeartbeat = 0;

    try {
      // 3. Determine input source: download locally or use presigned URL (Ticket 14 AC 5)
      const source = await resolveTranscodeSource({
        storage,
        rawBucket,
        sourceKey,
        tmpDir,
        rendition: rendition.name,
        streaming: depsStreamingInput ?? job.data.streamingInput === true,
        log,
      });
      if (isErr(source)) {
        return source.error.code === ErrorCodes.SOURCE_MISSING
          ? failTranscode(source.error as MediaFailure)
          : source;
      }

      // 4. Tail the output dir and upload as FFmpeg encodes (Ticket 14 AC 1, 2)
      const uploader = new StreamingSegmentUploader({
        outputDir: outDir,
        videoId,
        generation: job.data.generation,
        rendition: rendition.name,
        publicBucket,
        storage,
        concurrency: 4,
        maxRetries: 3,
        logger: log,
      });
      uploader.start();

      const encoded = await fromPromise(
        async () => {
          await runFfmpegTranscode({
            sourcePath: source.value,
            outputDir: outDir,
            rendition,
            fps,
            durationMs,
            threads,
            preset: ffmpeg.preset,
            attempt,
            onProgress: ({ percent }) => {
              const now = Date.now();
              if (now - lastProgressHeartbeat >= 2000 || percent === 100) {
                lastProgressHeartbeat = now;
                job.updateProgress?.(percent)?.catch?.(() => {});
                void repositories.steps.heartbeat(lockToken);
                fs.writeFile(heartbeatPath, new Date().toISOString()).catch(() => {});
                void progressReporter.report(percent);
              }
            },
          });
          await progressReporter.report(100);
        },
        (cause) => transcodeFailure(rendition.name, cause)
      );

      // 5. Complete uploader: drain segments, wait for idle, upload playlist LAST (AC 2)
      const uploadResult = await uploader.stop(encoded.ok);
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
        { rendition: rendition.name, segmentCount, bytes: totalBytes, processingMs },
        'Uploaded rendition segments and playlist to public storage'
      );

      // 6. Update renditions table to DONE
      const done = await repositories.renditions.update(videoId, rendition.name, {
        status: 'DONE',
        playlistKey,
        segmentCount,
        bytes: totalBytes,
        processingMs,
      });
      if (isErr(done)) return done;

      // 7. Complete step with fencing check
      const comp = await repositories.steps.complete({
        videoId,
        step: 'transcode',
        rendition: rendition.name,
        lockToken,
        result: { segmentCount, bytes: totalBytes, playlistKey, processingMs },
      });
      if (isErr(comp)) return comp;

      const avgBitrateBps = durationMs > 0 ? Math.round((totalBytes * 8) / (durationMs / 1000)) : 0;

      // Transcode-specific metrics (Ticket 22 AC 1)
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
        log.warn({ lockToken, event: 'FENCED_OUT' }, 'Fenced out on transcode completion');
        return ok(outcome);
      }

      // 8. Record transcode.completed in video_events
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
      // Guaranteed temp directory removal on every exit path (AC 21, Ticket 14 AC 1, 6)
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      // Clear tmp bytes metric once disk is freed
      metrics.workerTmpBytes.set({ stage }, 0);
    }
  };
}

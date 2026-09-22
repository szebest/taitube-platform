import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CacheClient, JobQueue, QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { ErrorCodes, PermanentError, PipelineError, TransientError } from '@vp/errors';
import { computeFfmpegThreads, runFfmpegTranscode } from '@vp/ffmpeg';
import type { TranscodeJob } from '@vp/job-contracts';
import { type Logger, type PipelineMetrics, getMetrics } from '@vp/observability';
import { uuidv7 } from 'uuidv7';
import { getHeartbeatPath } from '../config';
import { validateJobId } from '../registry';
import { TranscodeProgressReporter } from './progress-reporter';
import { StreamingSegmentUploader } from './segment-uploader';

export interface TranscodeProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  cache?: CacheClient;
  rawBucket?: string;
  publicBucket?: string;
  workerId?: string;
  logger: Logger;
  metrics?: PipelineMetrics;
  heartbeatPath?: string;
  getQueue?: (name: string) => JobQueue;
  simulateFailureRendition?: string;
  streamingInput?: boolean;
}

export function createTranscodeProcessor(deps: TranscodeProcessorDeps) {
  const {
    repositories,
    storage,
    rawBucket = process.env['STORAGE_RAW_BUCKET'] || 'raw',
    publicBucket = process.env['STORAGE_PUBLIC_BUCKET'] || 'public',
    workerId = `worker-${process.pid}`,
    logger,
    metrics: depsMetrics,
    heartbeatPath = getHeartbeatPath(),
    simulateFailureRendition = process.env['SIMULATE_FAILURE_RENDITION'],
    streamingInput: depsStreamingInput,
  } = deps;

  const metrics = depsMetrics ?? getMetrics();

  return async function processTranscodeJob(job: QueueJob<TranscodeJob>): Promise<{
    videoId: string;
    rendition: string;
    playlistKey: string;
    segmentCount: number;
    bytes: number;
    durationMs: number;
    avgBitrateBps: number;
    processingMs: number;
  }> {
    validateJobId(job.id || '');

    const { videoId, sourceKey, rendition, fps, durationMs } = job.data;
    const attempt = (job.attemptsMade ?? 0) + 1;
    const baseThreads = Number(process.env.FFMPEG_THREADS || '2');
    const threads = computeFfmpegThreads(baseThreads, attempt);

    const log = logger.child({
      videoId,
      jobId: job.id,
      stage: `transcode-${rendition.name}`,
      rendition: rendition.name,
      attempt,
      threads,
      baseThreads,
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

    if (claim.fenced) {
      log.warn({ lockToken }, 'Transcode step already completed; fenced out');
      return {
        videoId,
        rendition: rendition.name,
        playlistKey: '',
        segmentCount: 0,
        bytes: 0,
        durationMs,
        avgBitrateBps: 0,
        processingMs: 0,
      };
    }

    await repositories.renditions.update(videoId, rendition.name, {
      status: 'RUNNING',
    });

    // Simulated permanent failure check for resilience tests
    if (simulateFailureRendition === rendition.name) {
      const errorMsg = `Simulated permanent failure in transcode-${rendition.name}`;
      log.error({ rendition: rendition.name }, errorMsg);
      await repositories.steps.fail({
        videoId,
        step: 'transcode',
        rendition: rendition.name,
        lockToken,
        errorCode: ErrorCodes.FFMPEG_FAILED,
        errorMessage: errorMsg,
      });
      await repositories.renditions.update(videoId, rendition.name, {
        status: 'FAILED',
      });
      throw new PermanentError(ErrorCodes.FFMPEG_FAILED, errorMsg);
    }

    // 2. Per-job temp directory with guaranteed cleanup on every exit path (AC 21)
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `vp-transcode-${videoId}-${rendition.name}-`)
    );
    const outDir = path.join(tmpDir, 'hls');
    await fs.mkdir(outDir, { recursive: true });

    // Track temporary disk usage (worker_tmp_bytes metric)
    const srcBytes = (job.data as unknown as { sourceSizeBytes?: number }).sourceSizeBytes ?? 0;
    if (srcBytes > 0) {
      metrics.workerTmpBytes.set({ stage: `transcode-${rendition.name}` }, srcBytes);
    }

    let lastProgressHeartbeat = 0;

    try {
      // 3. Determine input source: download locally or use presigned URL streaming input (Ticket 14 AC 5)
      const useStreamingInput =
        depsStreamingInput ??
        (process.env['TRANSCODE_STREAMING_INPUT'] === 'true' ||
          process.env['STREAMING_INPUT'] === 'true' ||
          job.data.streamingInput === true);

      let sourcePath: string;
      if (useStreamingInput) {
        log.info({ sourceKey }, 'Using presigned URL streaming input mode for transcode');
        sourcePath = await storage.createPresignedGetUrl({
          bucket: rawBucket,
          key: sourceKey,
          expiresInSeconds: 7200,
        });
      } else {
        const localSourcePath = path.join(tmpDir, path.basename(sourceKey));
        const head = await storage.headObject(rawBucket, sourceKey);
        if (!head) {
          const errorMsg = `Source object not found in storage at ${sourceKey}`;
          log.error({ sourceKey }, errorMsg);
          await repositories.steps.fail({
            videoId,
            step: 'transcode',
            rendition: rendition.name,
            lockToken,
            errorCode: ErrorCodes.SOURCE_MISSING,
            errorMessage: errorMsg,
          });
          throw new PermanentError(ErrorCodes.SOURCE_MISSING, errorMsg);
        }

        const downloaded = await storage.downloadObject(rawBucket, sourceKey, localSourcePath);
        if (!downloaded) {
          const errorMsg = `Failed to download source object from ${sourceKey}`;
          log.error({ sourceKey }, errorMsg);
          await repositories.steps.fail({
            videoId,
            step: 'transcode',
            rendition: rendition.name,
            lockToken,
            errorCode: 'SOURCE_MISSING',
            errorMessage: errorMsg,
          });
          throw new PermanentError('SOURCE_MISSING', errorMsg);
        }
        sourcePath = localSourcePath;
      }

      // 4. Start StreamingSegmentUploader to tail output dir and upload as FFmpeg encodes (Ticket 14 AC 1, 2)
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

      let ffmpegError: Error | null = null;
      try {
        await runFfmpegTranscode({
          sourcePath,
          outputDir: outDir,
          rendition,
          fps,
          durationMs,
          threads,
          attempt,
          onProgress: ({ percent }) => {
            const now = Date.now();
            if (now - lastProgressHeartbeat >= 2000 || percent === 100) {
              lastProgressHeartbeat = now;
              job.updateProgress?.(percent)?.catch?.(() => {});
              repositories.steps.heartbeat(lockToken).catch(() => {});
              fs.writeFile(heartbeatPath, new Date().toISOString()).catch(() => {});
              progressReporter.report(percent).catch(() => {});
            }
          },
        });
        await progressReporter.report(100).catch(() => {});
      } catch (err) {
        ffmpegError = err as Error;
      }

      // 5. Complete uploader: drain segments, wait for idle, upload playlist LAST (AC 2)
      const uploadResult = await uploader.stop(!ffmpegError);
      if (ffmpegError) {
        throw ffmpegError;
      }
      if (!uploadResult) {
        throw new Error('Segment upload returned no result');
      }

      const totalBytes = uploadResult.totalBytes;
      const segmentCount = uploadResult.segmentCount;
      const playlistKey = uploadResult.playlistKey;
      const processingMs = Date.now() - startTime;

      log.info(
        {
          rendition: rendition.name,
          segmentCount,
          bytes: totalBytes,
          processingMs,
        },
        'Uploaded rendition segments and playlist to public storage'
      );

      // 6. Update renditions table to DONE
      await repositories.renditions.update(videoId, rendition.name, {
        status: 'DONE',
        playlistKey,
        segmentCount,
        bytes: totalBytes,
        processingMs,
      });

      // 7. Complete step with fencing check
      const comp = await repositories.steps.complete({
        videoId,
        step: 'transcode',
        rendition: rendition.name,
        lockToken,
        result: {
          segmentCount,
          bytes: totalBytes,
          playlistKey,
          processingMs,
        },
      });

      const avgBitrateBps = durationMs > 0 ? Math.round((totalBytes * 8) / (durationMs / 1000)) : 0;

      // Transcode-specific metrics (Ticket 22 AC 1)
      if (durationMs > 0 && processingMs > 0) {
        const realtimeFactor = durationMs / processingMs; // video_duration / encode_duration
        metrics.transcodeRealtimeFactor.observe(
          { rendition: rendition.name, preset: 'ultrafast' },
          realtimeFactor
        );
      }
      if (totalBytes > 0) {
        metrics.transcodeOutputBytes.inc({ rendition: rendition.name }, totalBytes);
      }

      if (comp.fenced) {
        log.warn({ lockToken, event: 'FENCED_OUT' }, 'Fenced out on transcode completion');
        return {
          videoId,
          rendition: rendition.name,
          playlistKey,
          segmentCount,
          bytes: totalBytes,
          durationMs,
          avgBitrateBps,
          processingMs,
        };
      }

      // 8. Record transcode.completed in video_events
      await repositories.events.create({
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

      return {
        videoId,
        rendition: rendition.name,
        playlistKey,
        segmentCount,
        bytes: totalBytes,
        durationMs,
        avgBitrateBps,
        processingMs,
      };
    } catch (err: unknown) {
      let classifiedErr = err as Error;
      const errorWithCode = err as { code?: string; hint?: string };
      const isEnospc =
        errorWithCode?.code === 'ENOSPC' ||
        (err as Error).message?.includes('ENOSPC') ||
        (err as Error).message?.toLowerCase().includes('no space left on device') ||
        errorWithCode?.hint === 'DISK_FULL';

      if (isEnospc && !(err instanceof PipelineError)) {
        classifiedErr = new TransientError(
          ErrorCodes.DISK_FULL,
          `ENOSPC disk exhaustion: ${(err as Error).message}`,
          { hint: 'DISK_FULL' }
        );
      }

      const errorCode =
        classifiedErr instanceof PipelineError
          ? (classifiedErr as PipelineError).code
          : isEnospc
            ? ErrorCodes.DISK_FULL
            : 'FFMPEG_FAILED';

      // ffmpeg_exit_total counter — classify transcode failures
      metrics.ffmpegExitTotal.inc({
        stage: `transcode-${rendition.name}`,
        code: errorCode,
      });

      await repositories.steps.fail({
        videoId,
        step: 'transcode',
        rendition: rendition.name,
        lockToken,
        errorCode,
        errorMessage: classifiedErr.message || 'Transcode failed',
      });

      throw classifiedErr;
    } finally {
      // Guaranteed temp directory removal on every exit path (AC 21, Ticket 14 AC 1, 6)
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      // Clear tmp bytes metric once disk is freed
      metrics.workerTmpBytes.set({ stage: `transcode-${rendition.name}` }, 0);
    }
  };
}

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { JobQueue, QueueJob, Repositories, StorageClient } from '@vp/core/ports';
import { PermanentError } from '@vp/errors';
import { runFfmpegTranscode } from '@vp/ffmpeg';
import type { TranscodeJob } from '@vp/job-contracts';
import type { Logger } from '@vp/observability';
import { getHeaderMapping } from '@vp/storage';
import { uuidv7 } from 'uuidv7';
import { validateJobId } from '../registry.js';

export interface TranscodeProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket?: string;
  publicBucket?: string;
  workerId?: string;
  logger: Logger;
  heartbeatPath?: string;
  getQueue?: (name: string) => JobQueue;
  simulateFailureRendition?: string;
}

export function createTranscodeProcessor(deps: TranscodeProcessorDeps) {
  const {
    repositories,
    storage,
    rawBucket = process.env['STORAGE_RAW_BUCKET'] || 'raw',
    publicBucket = process.env['STORAGE_PUBLIC_BUCKET'] || 'public',
    workerId = `worker-${process.pid}`,
    logger,
    heartbeatPath = process.env['WORKER_HEARTBEAT_PATH'] ||
      path.join(os.tmpdir(), 'worker-heartbeat'),
    simulateFailureRendition = process.env['SIMULATE_FAILURE_RENDITION'],
  } = deps;

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
    const log = logger.child({
      videoId,
      jobId: job.id,
      stage: `transcode-${rendition.name}`,
      rendition: rendition.name,
      attempt: (job.attemptsMade ?? 0) + 1,
    });

    const startTime = Date.now();
    log.info({ rendition: rendition.name, sourceKey }, 'Transcode job started');

    // Liveness heartbeat file (AC 21)
    await fs.writeFile(heartbeatPath, new Date().toISOString()).catch(() => {});

    // 1. Claim processing step with fencing token (SDD §5.3, §9.5, AC 20)
    const lockToken = uuidv7();
    const claim = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'transcode',
      rendition: rendition.name,
      jobId: job.id || '',
      attempt: (job.attemptsMade ?? 0) + 1,
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

    // Update rendition status to RUNNING (AC 2: PENDING -> RUNNING -> DONE)
    await repositories.renditions.update(videoId, rendition.name, {
      status: 'RUNNING',
    });

    // Simulated permanent failure check for resilience tests (AC 5)
    if (simulateFailureRendition === rendition.name) {
      const errorMsg = `Simulated permanent failure in transcode-${rendition.name}`;
      log.error({ rendition: rendition.name }, errorMsg);
      await repositories.steps.fail({
        videoId,
        step: 'transcode',
        rendition: rendition.name,
        lockToken,
        errorCode: 'FFMPEG_FAILED',
        errorMessage: errorMsg,
      });
      await repositories.renditions.update(videoId, rendition.name, {
        status: 'FAILED',
      });
      throw new PermanentError('FFMPEG_FAILED', errorMsg);
    }

    // 2. Per-job temp directory with guaranteed cleanup on every exit path (AC 21)
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `vp-transcode-${videoId}-${rendition.name}-`)
    );
    const outDir = path.join(tmpDir, 'hls');
    await fs.mkdir(outDir, { recursive: true });

    let lastProgressHeartbeat = 0;

    try {
      // 3. Download source from storage
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
          errorCode: 'SOURCE_MISSING',
          errorMessage: errorMsg,
        });
        throw new PermanentError('SOURCE_MISSING', errorMsg);
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

      // 4. Run FFmpeg transcode with throttled progress (AC 22)
      await runFfmpegTranscode({
        sourcePath: localSourcePath,
        outputDir: outDir,
        rendition,
        fps,
        durationMs,
        onProgress: ({ percent }) => {
          const now = Date.now();
          // Throttled to at most every 2 seconds (AC 22, SDD §9.5)
          if (now - lastProgressHeartbeat >= 2000) {
            lastProgressHeartbeat = now;
            (job as any).updateProgress?.(percent)?.catch?.(() => {});
            repositories.steps.heartbeat(lockToken).catch(() => {});
            fs.writeFile(heartbeatPath, new Date().toISOString()).catch(() => {});
          }
        },
      });

      // 5. Upload generated TS segments and playlist
      const outFiles = await fs.readdir(outDir);
      const segmentFiles = outFiles.filter((f) => f.endsWith('.ts')).sort();
      const playlistFile = outFiles.find((f) => f === 'index.m3u8');

      if (!playlistFile || segmentFiles.length === 0) {
        throw new Error(`FFmpeg completed without producing index.m3u8 or segments in ${outDir}`);
      }

      let totalBytes = 0;

      // Upload segments first with immutable cache headers (SDD §7)
      for (const segName of segmentFiles) {
        const segPath = path.join(outDir, segName);
        const stat = await fs.stat(segPath);
        totalBytes += stat.size;
        const body = await fs.readFile(segPath);
        const segKey = `videos/${videoId}/hls/${rendition.name}/${segName}`;
        const headers = getHeaderMapping(segName);

        await storage.uploadObject({
          bucket: publicBucket,
          key: segKey,
          body,
          contentType: headers.contentType,
          cacheControl: headers.cacheControl,
        });
      }

      // Upload index.m3u8 LAST (presence == rendition complete, SDD §7, §9.7)
      const playlistPath = path.join(outDir, 'index.m3u8');
      const playlistContent = await fs.readFile(playlistPath);
      totalBytes += playlistContent.byteLength;
      const playlistKey = `videos/${videoId}/hls/${rendition.name}/index.m3u8`;
      const playlistHeaders = getHeaderMapping('index.m3u8');

      await storage.uploadObject({
        bucket: publicBucket,
        key: playlistKey,
        body: playlistContent,
        contentType: playlistHeaders.contentType,
        cacheControl: playlistHeaders.cacheControl,
      });

      const processingMs = Date.now() - startTime;
      log.info(
        {
          rendition: rendition.name,
          segmentCount: segmentFiles.length,
          bytes: totalBytes,
          processingMs,
        },
        'Uploaded rendition segments and playlist to public storage'
      );

      // 6. Update renditions table to DONE (AC 17)
      await repositories.renditions.update(videoId, rendition.name, {
        status: 'DONE',
        playlistKey,
        segmentCount: segmentFiles.length,
        bytes: totalBytes,
        processingMs,
      });

      // 7. Complete step with fencing check (AC 20)
      const comp = await repositories.steps.complete({
        videoId,
        step: 'transcode',
        rendition: rendition.name,
        lockToken,
        result: {
          segmentCount: segmentFiles.length,
          bytes: totalBytes,
          playlistKey,
          processingMs,
        },
      });

      const avgBitrateBps = durationMs > 0 ? Math.round((totalBytes * 8) / (durationMs / 1000)) : 0;

      if (comp.fenced) {
        log.warn({ lockToken, event: 'FENCED_OUT' }, 'Fenced out on transcode completion');
        return {
          videoId,
          rendition: rendition.name,
          playlistKey,
          segmentCount: segmentFiles.length,
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
          segmentCount: segmentFiles.length,
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
        segmentCount: segmentFiles.length,
        bytes: totalBytes,
        durationMs,
        avgBitrateBps,
        processingMs,
      };
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'Transcode failed';
      const isPermanent = err instanceof PermanentError;

      await repositories.steps.fail({
        videoId,
        step: 'transcode',
        rendition: rendition.name,
        lockToken,
        errorCode: isPermanent ? (err as PermanentError).code : 'FFMPEG_FAILED',
        errorMessage: errorMsg,
      });

      throw err;
    } finally {
      // Guaranteed temp directory removal on every exit path (AC 21)
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  };
}

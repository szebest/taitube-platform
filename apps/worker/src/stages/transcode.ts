import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  type Database,
  claimStep,
  completeStep,
  failStep,
  heartbeatStep,
  renditions,
  videoEvents,
} from '@vp/db';
import { PermanentError } from '@vp/errors';
import { runFfmpegTranscode } from '@vp/ffmpeg';
import {
  PackageJob,
  type TranscodeJob,
  defaultJobOptions,
  ids,
  stagePolicies,
} from '@vp/job-contracts';
import type { Logger } from '@vp/observability';
import {
  type S3Client,
  downloadObject,
  getHeaderMapping,
  headObject,
  uploadObject,
} from '@vp/storage';
import { type Job, type Queue, UnrecoverableError } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { validateJobId } from '../registry.js';

export interface TranscodeProcessorDeps {
  db: Database;
  s3Client: S3Client;
  rawBucket?: string;
  publicBucket?: string;
  workerId?: string;
  logger: Logger;
  heartbeatPath?: string;
  getQueue?: (name: string) => Queue;
}

export function createTranscodeProcessor(deps: TranscodeProcessorDeps) {
  const {
    db,
    s3Client,
    rawBucket = process.env.STORAGE_RAW_BUCKET || 'raw',
    publicBucket = process.env.STORAGE_PUBLIC_BUCKET || 'public',
    workerId = `worker-${process.pid}`,
    logger,
    heartbeatPath = process.env.WORKER_HEARTBEAT_PATH || path.join(os.tmpdir(), 'worker-heartbeat'),
    getQueue,
  } = deps;

  return async function processTranscodeJob(job: Job<TranscodeJob>): Promise<{
    videoId: string;
    rendition: string;
    segmentCount: number;
    bytes: number;
    processingMs: number;
  }> {
    validateJobId(job.id || '');

    const { videoId, sourceKey, generation, rendition, fps, durationMs } = job.data;
    const log = logger.child({
      videoId,
      jobId: job.id,
      stage: `transcode-${rendition.name}`,
      rendition: rendition.name,
      attempt: job.attemptsMade + 1,
    });

    const startTime = Date.now();
    log.info({ rendition: rendition.name, sourceKey }, 'Transcode job started');

    // Liveness heartbeat file (AC 21)
    await fs.writeFile(heartbeatPath, new Date().toISOString()).catch(() => {});

    // 1. Claim processing step with fencing token (SDD §5.3, §9.5, AC 20)
    const lockToken = uuidv7();
    const claim = await claimStep(db, {
      id: uuidv7(),
      videoId,
      step: 'transcode',
      rendition: rendition.name,
      jobId: job.id || '',
      attempt: job.attemptsMade + 1,
      workerId,
      lockToken,
    });

    if (claim.fenced) {
      log.warn({ lockToken }, 'Transcode step already completed; fenced out');
      return {
        videoId,
        rendition: rendition.name,
        segmentCount: 0,
        bytes: 0,
        processingMs: 0,
      };
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
      const head = await headObject(s3Client, rawBucket, sourceKey);
      if (!head) {
        const errorMsg = `Source object not found in storage at ${sourceKey}`;
        log.error({ sourceKey }, errorMsg);
        await failStep(db, {
          videoId,
          step: 'transcode',
          rendition: rendition.name,
          lockToken,
          errorCode: 'SOURCE_MISSING',
          errorMessage: errorMsg,
        });
        throw new UnrecoverableError(errorMsg);
      }

      const downloaded = await downloadObject(s3Client, rawBucket, sourceKey, localSourcePath);
      if (!downloaded) {
        const errorMsg = `Failed to download source object from ${sourceKey}`;
        log.error({ sourceKey }, errorMsg);
        await failStep(db, {
          videoId,
          step: 'transcode',
          rendition: rendition.name,
          lockToken,
          errorCode: 'SOURCE_MISSING',
          errorMessage: errorMsg,
        });
        throw new UnrecoverableError(errorMsg);
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
            job.updateProgress(percent).catch(() => {});
            heartbeatStep(db, lockToken).catch(() => {});
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

        await uploadObject(s3Client, {
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

      await uploadObject(s3Client, {
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
      await db
        .update(renditions)
        .set({
          status: 'DONE',
          playlistKey,
          segmentCount: segmentFiles.length,
          bytes: totalBytes,
          processingMs,
          updatedAt: new Date(),
        })
        .where(and(eq(renditions.videoId, videoId), eq(renditions.name, rendition.name)));

      // 7. Complete step with fencing check (AC 20)
      const comp = await completeStep(db, {
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

      if (comp.fenced) {
        log.warn({ lockToken }, 'Fenced out on transcode completion; not enqueueing package');
        return {
          videoId,
          rendition: rendition.name,
          segmentCount: segmentFiles.length,
          bytes: totalBytes,
          processingMs,
        };
      }

      // 8. Record transcode.completed in video_events
      await db.insert(videoEvents).values({
        videoId,
        type: 'transcode.completed',
        payload: {
          rendition: rendition.name,
          segmentCount: segmentFiles.length,
          bytes: totalBytes,
          processingMs,
        },
      });

      // 9. Enqueue package job (SDD §3.2, §9.2)
      if (getQueue) {
        const packageQueue = getQueue('package');
        const packageJobId = ids.package(videoId, generation);
        await packageQueue.add(
          'package',
          PackageJob.parse({
            videoId,
            generation,
            ladder: [rendition],
            traceparent: job.data.traceparent,
          }),
          {
            jobId: packageJobId,
            ...stagePolicies.package,
            ...defaultJobOptions,
          }
        );
        log.info({ packageJobId }, 'Enqueued package follow-up job');
      }

      return {
        videoId,
        rendition: rendition.name,
        segmentCount: segmentFiles.length,
        bytes: totalBytes,
        processingMs,
      };
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'Transcode failed';
      const isPermanent = err instanceof PermanentError;

      await failStep(db, {
        videoId,
        step: 'transcode',
        rendition: rendition.name,
        lockToken,
        errorCode: isPermanent ? (err as PermanentError).code : 'FFMPEG_FAILED',
        errorMessage: errorMsg,
      });

      if (isPermanent) {
        throw new UnrecoverableError(errorMsg);
      }
      throw err;
    } finally {
      // Guaranteed temp directory removal on every exit path (AC 21)
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  };
}

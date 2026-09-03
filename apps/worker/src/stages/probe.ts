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
  transitionVideo,
  videos,
} from '@vp/db';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { type ProbeMetadata, runFfprobe } from '@vp/ffmpeg';
import type { ProbeJob } from '@vp/job-contracts';
import type { Logger } from '@vp/observability';
import { type S3Client, downloadObject, headObject } from '@vp/storage';
import { type Job, UnrecoverableError } from 'bullmq';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { validateJobId } from '../registry.js';

export interface ProbeProcessorDeps {
  db: Database;
  s3Client: S3Client;
  rawBucket?: string;
  workerId?: string;
  logger: Logger;
  heartbeatPath?: string;
}

export function createProbeProcessor(deps: ProbeProcessorDeps) {
  const {
    db,
    s3Client,
    rawBucket = process.env.STORAGE_RAW_BUCKET || 'raw',
    workerId = `worker-${process.pid}`,
    logger,
    heartbeatPath = process.env.WORKER_HEARTBEAT_PATH || path.join(os.tmpdir(), 'worker-heartbeat'),
  } = deps;

  return async function processProbeJob(
    job: Job<ProbeJob>
  ): Promise<{ videoId: string; status: string; durationMs: number }> {
    // 1. Validate Job ID (AC 22)
    validateJobId(job.id || '');

    const { videoId, sourceKey } = job.data;
    const log = logger.child({
      videoId,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      stage: 'probe',
    });

    log.info({ sourceKey }, 'Probe job started');

    // Update heartbeat file for container liveness (SDD §9.4, AC 20)
    await fs.writeFile(heartbeatPath, new Date().toISOString()).catch(() => {});

    // 2. CAS Transition: UPLOADED -> PROBING (AC 17)
    const started = await transitionVideo(db, {
      videoId,
      from: 'UPLOADED',
      to: 'PROBING',
      eventType: 'probe.started',
      eventPayload: {
        jobId: job.id,
        attempt: job.attemptsMade + 1,
      },
    });

    if (!started) {
      // Check current video state
      const [current] = await db.select().from(videos).where(eq(videos.id, videoId));
      if (current && ['PROCESSING', 'READY', 'FAILED', 'DELETED'].includes(current.status)) {
        log.info(
          { status: current.status },
          'Video already past PROBING; skipping redundant execution'
        );
        return {
          videoId,
          status: current.status,
          durationMs: current.durationMs || 0,
        };
      }
    }

    // 3. Claim processing step with fresh fencing token (SDD §5.3, §9.5, AC 20)
    const lockToken = uuidv7();
    const claim = await claimStep(db, {
      id: uuidv7(),
      videoId,
      step: 'probe',
      rendition: '-',
      jobId: job.id || '',
      attempt: job.attemptsMade + 1,
      workerId,
      lockToken,
    });

    if (claim.fenced) {
      log.warn({ lockToken }, 'Probe step already completed; fenced out');
      return { videoId, status: 'DONE', durationMs: 0 };
    }

    // Heartbeat update on processing_steps (AC 20)
    await heartbeatStep(db, lockToken);

    // 4. Per-job temp directory with guaranteed cleanup on every exit path (AC 21)
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vp-probe-${videoId}-`));

    try {
      // 5. Verify source in S3 (AC 19)
      const head = await headObject(s3Client, rawBucket, sourceKey);
      if (!head) {
        const errorMsg = `Source object not found in storage at ${sourceKey}`;
        log.error({ sourceKey }, errorMsg);

        await failStep(db, {
          videoId,
          step: 'probe',
          rendition: '-',
          lockToken,
          errorCode: ErrorCodes.SOURCE_MISSING,
          errorMessage: errorMsg,
        });

        await transitionVideo(db, {
          videoId,
          from: 'PROBING',
          to: 'FAILED',
          eventType: 'probe.failed',
          eventPayload: { errorCode: ErrorCodes.SOURCE_MISSING },
          patch: {
            errorCode: ErrorCodes.SOURCE_MISSING,
            errorMessage: errorMsg,
          },
        });

        throw new UnrecoverableError(
          new PermanentError(ErrorCodes.SOURCE_MISSING, errorMsg).message
        );
      }

      // Download source to local file for ffprobe analysis
      const localSourcePath = path.join(tmpDir, path.basename(sourceKey));
      const downloaded = await downloadObject(s3Client, rawBucket, sourceKey, localSourcePath);

      if (!downloaded) {
        const errorMsg = `Failed to download source object from ${sourceKey}`;
        log.error({ sourceKey }, errorMsg);

        await failStep(db, {
          videoId,
          step: 'probe',
          rendition: '-',
          lockToken,
          errorCode: ErrorCodes.SOURCE_MISSING,
          errorMessage: errorMsg,
        });

        await transitionVideo(db, {
          videoId,
          from: 'PROBING',
          to: 'FAILED',
          eventType: 'probe.failed',
          eventPayload: { errorCode: ErrorCodes.SOURCE_MISSING },
          patch: {
            errorCode: ErrorCodes.SOURCE_MISSING,
            errorMessage: errorMsg,
          },
        });

        throw new UnrecoverableError(errorMsg);
      }

      // 6. Run ffprobe and validate media (AC 17, AC 18)
      let metadata: ProbeMetadata;
      try {
        metadata = await runFfprobe(localSourcePath);
      } catch (err: unknown) {
        const permError =
          err instanceof PermanentError
            ? err
            : new PermanentError(ErrorCodes.CORRUPT_CONTAINER, (err as Error).message);

        log.warn(
          { errorCode: permError.code, err: permError.message },
          'Probe validation failed with permanent error'
        );

        // Record failure in processing_steps
        await failStep(db, {
          videoId,
          step: 'probe',
          rendition: '-',
          lockToken,
          errorCode: permError.code,
          errorMessage: permError.message,
        });

        // Transition video to FAILED (AC 18)
        await transitionVideo(db, {
          videoId,
          from: 'PROBING',
          to: 'FAILED',
          eventType: 'probe.failed',
          eventPayload: {
            errorCode: permError.code,
            errorMessage: permError.message,
          },
          patch: {
            errorCode: permError.code,
            errorMessage: permError.message,
          },
        });

        // Fail job immediately on attempt 1 without BullMQ retry (AC 18)
        throw new UnrecoverableError(permError.message);
      }

      log.info(
        {
          durationMs: metadata.durationMs,
          ladder: metadata.ladder.map((r) => r.name),
          dimensions: `${metadata.effectiveWidth}x${metadata.effectiveHeight}`,
        },
        'Probe successful, updating database and pending renditions'
      );

      // 7. Insert pending renditions rows for each ladder entry (AC 17)
      for (const entry of metadata.ladder) {
        await db
          .insert(renditions)
          .values({
            id: uuidv7(),
            videoId,
            name: entry.name,
            width: entry.width,
            height: entry.height,
            videoBitrateKbps: entry.videoKbps,
            audioBitrateKbps: entry.audioKbps,
            status: 'PENDING',
          })
          .onConflictDoNothing();
      }

      // 8. Complete step with fencing token check (AC 20)
      const comp = await completeStep(db, {
        videoId,
        step: 'probe',
        rendition: '-',
        lockToken,
        result: {
          durationMs: metadata.durationMs,
          ladder: metadata.ladder.map((r) => r.name),
          width: metadata.effectiveWidth,
          height: metadata.effectiveHeight,
          fps: metadata.fps,
        },
      });

      if (comp.fenced) {
        log.warn({ lockToken }, 'Fenced out on step completion (another worker reclaimed step)');
        return {
          videoId,
          status: 'FENCED',
          durationMs: metadata.durationMs,
        };
      }

      // 9. CAS transition: PROBING -> PROCESSING with metadata patch (AC 17)
      await transitionVideo(db, {
        videoId,
        from: 'PROBING',
        to: 'PROCESSING',
        eventType: 'probe.completed',
        eventPayload: {
          durationMs: metadata.durationMs,
          ladder: metadata.ladder.map((r) => r.name),
        },
        patch: {
          durationMs: metadata.durationMs,
          width: metadata.effectiveWidth,
          height: metadata.effectiveHeight,
          fps: String(metadata.fps),
          videoCodec: metadata.videoCodec,
          audioCodec: metadata.audioCodec,
          ladder: metadata.ladder,
        },
      });

      return {
        videoId,
        status: 'PROCESSING',
        durationMs: metadata.durationMs,
      };
    } finally {
      // Guaranteed temp directory removal on every exit path (AC 21)
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  };
}

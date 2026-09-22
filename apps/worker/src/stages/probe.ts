import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { FlowProducerPort, JobQueue, QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { type ProbeMetadata, runFfprobe } from '@vp/ffmpeg';
import type { ProbeJob } from '@vp/job-contracts';
import { type Logger, getMetrics } from '@vp/observability';
import { unwrapOr } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { getHeartbeatPath } from '../config';
import { unwrapOrThrow } from '../queue-error';
import { validateJobId } from '../registry';
import { enqueueFollowUpJobs } from './probe-enqueue';
import { recordProbeFailure } from './probe-failure';

export interface ProbeProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  rawBucket?: string;
  workerId?: string;
  logger: Logger;
  heartbeatPath?: string;
  getQueue?: (name: string) => JobQueue;
  flowProducer?: FlowProducerPort;
}

export function createProbeProcessor(deps: ProbeProcessorDeps) {
  const {
    repositories,
    storage,
    rawBucket = process.env['STORAGE_RAW_BUCKET'] || 'raw',
    workerId = `worker-${process.pid}`,
    logger,
    heartbeatPath = getHeartbeatPath(),
    getQueue,
    flowProducer,
  } = deps;

  return async function processProbeJob(
    job: QueueJob<ProbeJob>
  ): Promise<{ videoId: string; status: string; durationMs: number }> {
    // 1. Validate Job ID (AC 22)
    validateJobId(job.id || '');

    const { videoId, sourceKey } = job.data;
    const log = logger.child({
      videoId,
      jobId: job.id,
      attempt: (job.attemptsMade ?? 0) + 1,
      stage: 'probe',
    });

    log.info({ sourceKey }, 'Probe job started');

    // Update heartbeat file for container liveness (SDD §9.4, AC 20)
    await fs.writeFile(heartbeatPath, new Date().toISOString()).catch(() => {});

    // 2. CAS Transition: UPLOADED -> PROBING (AC 17)
    const started = unwrapOrThrow(
      await repositories.videos.transition({
        videoId,
        from: 'UPLOADED',
        to: 'PROBING',
        eventType: 'probe.started',
        eventPayload: {
          jobId: job.id,
          attempt: (job.attemptsMade ?? 0) + 1,
        },
      })
    );

    if (!started) {
      // Check current video state
      const current = unwrapOrThrow(await repositories.videos.findById(videoId));
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
    const claim = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'probe',
      rendition: '-',
      jobId: job.id || '',
      attempt: (job.attemptsMade ?? 0) + 1,
      workerId,
      lockToken,
    });

    if (claim.fenced) {
      log.warn({ lockToken }, 'Probe step already completed; fenced out');
      return { videoId, status: 'DONE', durationMs: 0 };
    }

    // Heartbeat update on processing_steps (AC 20)
    await repositories.steps.heartbeat(lockToken);

    // 4. Per-job temp directory with guaranteed cleanup on every exit path (AC 21)
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `vp-probe-${videoId}-`));

    const failProbe = async (code: string, msg: string): Promise<never> => {
      await recordProbeFailure({ repositories, job, lockToken, getQueue }, code, msg);
      throw new PermanentError(code, msg);
    };

    try {
      // 5. Verify source in S3 (AC 19)
      const head = await storage.headObject(rawBucket, sourceKey);
      if (!head) {
        const errorMsg = `Source object not found in storage at ${sourceKey}`;
        log.error({ sourceKey }, errorMsg);
        return await failProbe(ErrorCodes.SOURCE_MISSING, errorMsg);
      }

      // Download source to local file for ffprobe analysis
      const localSourcePath = path.join(tmpDir, path.basename(sourceKey));
      const downloaded = await storage.downloadObject(rawBucket, sourceKey, localSourcePath);

      if (!downloaded) {
        const errorMsg = `Failed to download source object from ${sourceKey}`;
        log.error({ sourceKey }, errorMsg);
        return await failProbe(ErrorCodes.SOURCE_MISSING, errorMsg);
      }

      if (head.contentLength) {
        getMetrics().workerTmpBytes.set({ stage: 'probe' }, head.contentLength);
      }

      // 6. Run ffprobe and validate media (AC 17, AC 18)
      let metadata: ProbeMetadata;
      try {
        metadata = await runFfprobe(localSourcePath);
        getMetrics().ffmpegExitTotal.inc({ stage: 'probe', code: '0' });
      } catch (err: unknown) {
        const permError =
          err instanceof PermanentError
            ? err
            : new PermanentError(ErrorCodes.CORRUPT_CONTAINER, (err as Error).message);

        getMetrics().ffmpegExitTotal.inc({ stage: 'probe', code: permError.code });

        log.warn(
          { errorCode: permError.code, err: permError.message },
          'Probe validation failed with permanent error'
        );
        return await failProbe(permError.code, permError.message);
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
        await repositories.renditions.create({
          id: uuidv7(),
          videoId,
          name: entry.name,
          width: entry.width,
          height: entry.height,
          videoBitrateKbps: entry.videoKbps,
          audioBitrateKbps: entry.audioKbps,
          status: 'PENDING',
        });
      }

      // 8. Complete step with fencing token check (AC 20)
      const comp = await repositories.steps.complete({
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
      unwrapOrThrow(
        await repositories.videos.transition({
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
            fps: metadata.fps,
            ladder: metadata.ladder,
          },
        })
      );

      // Determine priority from job opts or user tier (SDD §9.4, AC 3)
      let priority = job.opts?.priority;
      if (priority === undefined && repositories.users) {
        try {
          const videoRec = unwrapOr(await repositories.videos.findById(videoId), null);
          if (videoRec?.ownerId) {
            const userRec = unwrapOr(await repositories.users.findById(videoRec.ownerId), null);
            if (userRec?.tier === 'pro' || userRec?.tier === 'enterprise') {
              priority = 1;
            }
          }
        } catch {}
      }
      if (priority === undefined) {
        priority = 5;
      }

      // 10. Enqueue fan-out / fan-in Flow (SDD §3.2, §9.3, Ticket 12)
      await enqueueFollowUpJobs({
        job,
        metadata,
        priority,
        flowProducer,
        getQueue,
        log,
      });

      return {
        videoId,
        status: 'PROCESSING',
        durationMs: metadata.durationMs,
      };
    } finally {
      // Guaranteed temp directory removal on every exit path (AC 21)
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      getMetrics().workerTmpBytes.set({ stage: 'probe' }, 0);
    }
  };
}

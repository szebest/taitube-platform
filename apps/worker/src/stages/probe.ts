import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  FlowProducerPort,
  JobQueue,
  QueueJob,
  Repositories,
  StorageClient,
} from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { type ProbeMetadata, runFfprobe } from '@vp/ffmpeg';
import {
  PackageJob,
  type ProbeJob,
  TranscodeJob,
  defaultJobOptions,
  ids,
  stagePolicies,
} from '@vp/job-contracts';
import type { Logger } from '@vp/observability';
import { uuidv7 } from 'uuidv7';
import { validateJobId } from '../registry.js';

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
    heartbeatPath = process.env['WORKER_HEARTBEAT_PATH'] ||
      path.join(os.tmpdir(), 'worker-heartbeat'),
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
    const started = await repositories.videos.transition({
      videoId,
      from: 'UPLOADED',
      to: 'PROBING',
      eventType: 'probe.started',
      eventPayload: {
        jobId: job.id,
        attempt: (job.attemptsMade ?? 0) + 1,
      },
    });

    if (!started) {
      // Check current video state
      const current = await repositories.videos.findById(videoId);
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

    try {
      // 5. Verify source in S3 (AC 19)
      const head = await storage.headObject(rawBucket, sourceKey);
      if (!head) {
        const errorMsg = `Source object not found in storage at ${sourceKey}`;
        log.error({ sourceKey }, errorMsg);

        await repositories.steps.fail({
          videoId,
          step: 'probe',
          rendition: '-',
          lockToken,
          errorCode: ErrorCodes.SOURCE_MISSING,
          errorMessage: errorMsg,
        });

        await repositories.videos.transition({
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

        throw new PermanentError(ErrorCodes.SOURCE_MISSING, errorMsg);
      }

      // Download source to local file for ffprobe analysis
      const localSourcePath = path.join(tmpDir, path.basename(sourceKey));
      const downloaded = await storage.downloadObject(rawBucket, sourceKey, localSourcePath);

      if (!downloaded) {
        const errorMsg = `Failed to download source object from ${sourceKey}`;
        log.error({ sourceKey }, errorMsg);

        await repositories.steps.fail({
          videoId,
          step: 'probe',
          rendition: '-',
          lockToken,
          errorCode: ErrorCodes.SOURCE_MISSING,
          errorMessage: errorMsg,
        });

        await repositories.videos.transition({
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

        throw new PermanentError(ErrorCodes.SOURCE_MISSING, errorMsg);
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
        await repositories.steps.fail({
          videoId,
          step: 'probe',
          rendition: '-',
          lockToken,
          errorCode: permError.code,
          errorMessage: permError.message,
        });

        // Transition video to FAILED (AC 18)
        await repositories.videos.transition({
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

        // Fail job immediately on attempt 1 without retry
        throw permError;
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
          ladder: metadata.ladder,
        },
      });

      // 10. Enqueue fan-out / fan-in Flow (SDD §3.2, §9.3, Ticket 12)
      if (flowProducer) {
        const packageJobId = ids.package(videoId, job.data.generation);
        await flowProducer.add({
          name: 'package',
          queueName: 'package',
          data: PackageJob.parse({
            videoId,
            generation: job.data.generation,
            ladder: metadata.ladder,
            traceparent: job.data.traceparent,
          }),
          opts: {
            jobId: packageJobId,
            ...stagePolicies.package,
            ...defaultJobOptions,
          },
          children: metadata.ladder.map((r) => {
            const queueName = `transcode-${r.name}` as const;
            const transcodeJobId = ids.transcode(videoId, r.name, job.data.generation);
            return {
              name: queueName,
              queueName,
              data: TranscodeJob.parse({
                videoId,
                sourceKey,
                generation: job.data.generation,
                rendition: r,
                fps: metadata.fps,
                durationMs: metadata.durationMs,
                traceparent: job.data.traceparent,
              }),
              opts: {
                jobId: transcodeJobId,
                ...stagePolicies[queueName as keyof typeof stagePolicies],
                ...defaultJobOptions,
                failParentOnFailure: true,
                removeDependencyOnFailure: false,
              },
            };
          }),
        });
        log.info(
          { packageJobId, ladder: metadata.ladder.map((r) => r.name) },
          'Created BullMQ flow with package parent and transcode children'
        );
      } else if (getQueue) {
        const r720 = metadata.ladder.find((r) => r.name === '720p') || metadata.ladder[0];
        if (r720) {
          const transcodeQueueName = `transcode-${r720.name}`;
          const transcodeJobId = ids.transcode(videoId, r720.name, job.data.generation);
          const queue = getQueue(transcodeQueueName);
          await queue.add(
            transcodeQueueName,
            TranscodeJob.parse({
              videoId,
              sourceKey,
              generation: job.data.generation,
              rendition: r720,
              fps: metadata.fps,
              durationMs: metadata.durationMs,
              traceparent: job.data.traceparent,
            }),
            {
              jobId: transcodeJobId,
              ...stagePolicies[transcodeQueueName as keyof typeof stagePolicies],
              ...defaultJobOptions,
            }
          );
          log.info(
            { transcodeJobId, queue: transcodeQueueName },
            'Enqueued transcode follow-up job'
          );
        }
      }

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

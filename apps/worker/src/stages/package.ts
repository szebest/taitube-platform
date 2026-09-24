import type { JobQueue, QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { CdnBase } from '@vp/env-schema';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type MediaFailure,
  type QueueUnavailable,
  type StorageUnavailable,
  mediaFailure,
} from '@vp/errors';
import { generateMasterPlaylist } from '@vp/ffmpeg';
import {
  NotifyJob,
  type PackageJob,
  type ThumbnailResult,
  type TranscodeResult,
  defaultJobOptions,
  ids,
  stagePolicies,
} from '@vp/job-contracts';
import { type Logger, getMetrics } from '@vp/observability';
import { type Result, err, isErr, ok } from '@vp/result';
import { getHeaderMapping, masterPlaylistKey, renditionPlaylistKey } from '@vp/storage';
import { uuidv7 } from 'uuidv7';

import { MS_PER_SECOND } from '@vp/domain/time';
import { validateJobId } from '../job-identity';

export interface PackageProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  publicBucket: string;
  cdn: CdnBase;
  workerId: string;
  logger: Logger;
  getQueue?: (name: string) => JobQueue;
}

export interface PackageStageResult {
  videoId: string;
  masterKey: string;
  playbackUrl: string;
}

export type PackageStageFailure =
  | MediaFailure
  | StorageUnavailable
  | DatabaseUnavailable
  | QueueUnavailable;

export function createPackageProcessor(deps: PackageProcessorDeps) {
  const { repositories, storage, publicBucket, cdn, workerId, logger, getQueue } = deps;

  return async function processPackageJob(
    job: QueueJob<PackageJob>
  ): Promise<Result<PackageStageResult, PackageStageFailure>> {
    validateJobId(job.id || '');

    const { videoId, generation, ladder } = job.data;
    const log = logger.child({
      videoId,
      jobId: job.id,
      stage: 'package',
      attempt: (job.attemptsMade ?? 0) + 1,
    });

    log.info({ ladder: ladder.map((r) => r.name) }, 'Package job started');

    // 1. Claim processing step (SDD §5.3, §9.5, AC 20)
    const lockToken = uuidv7();
    const claim = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'package',
      rendition: '-',
      jobId: job.id || '',
      attempt: (job.attemptsMade ?? 0) + 1,
      workerId,
      lockToken,
    });

    if (isErr(claim)) return claim;

    if (claim.value.fenced) {
      log.warn({ lockToken }, 'Package step already completed; fenced out');
      return ok({
        videoId,
        masterKey: masterPlaylistKey(videoId, generation),
        playbackUrl: `${cdn}/${masterPlaylistKey(videoId, generation)}`,
      });
    }

    const beat = await repositories.steps.heartbeat(lockToken);
    if (isErr(beat)) return beat;

    /** One place records how a package ended, so every exit reports the same way. */
    const failPackage = async (
      failure: MediaFailure
    ): Promise<Result<never, PackageStageFailure>> => {
      const recorded = await repositories.steps.fail({
        videoId,
        step: 'package',
        rendition: '-',
        lockToken,
        errorCode: failure.code,
        errorMessage: failure.message,
      });
      return isErr(recorded) ? recorded : err(failure);
    };

    // 2. Read children values from Flow transcode jobs (SDD §9.3, Ticket 12 AC 6)
    const rawChildren = job.getChildrenValues ? await job.getChildrenValues() : {};
    const childrenValues = rawChildren ? Object.values(rawChildren) : [];
    const measuredResults: Record<
      string,
      { bytes?: number; durationMs?: number; avgBitrateBps?: number }
    > = {};

    let thumbResult: ThumbnailResult | undefined;

    for (const val of childrenValues) {
      if (val && typeof val === 'object') {
        if ('rendition' in val) {
          const res = val as unknown as TranscodeResult;
          measuredResults[res.rendition] = {
            bytes: res.bytes,
            durationMs: res.durationMs,
            avgBitrateBps: res.avgBitrateBps,
          };
        } else if ('posterKey' in val) {
          thumbResult = val as unknown as ThumbnailResult;
        }
      }
    }

    // 3. AC 19: Verify every rendition playlist exists via HEAD before writing master
    for (const r of ladder) {
      const rendKey = renditionPlaylistKey(videoId, r.name, generation);
      const head = await storage.headObject(publicBucket, rendKey);
      if (isErr(head)) return head;

      if (!head.value) {
        log.error({ rendKey }, 'Rendition playlist missing');
        return failPackage(
          mediaFailure(
            'package',
            ErrorCodes.SEGMENT_VERIFY_FAILED,
            `Rendition playlist missing at ${rendKey}`
          )
        );
      }
    }

    // Query video metadata for fps
    const videoResult = await repositories.videos.findById(videoId);
    if (isErr(videoResult)) return videoResult;
    const video = videoResult.value;
    const fps = video?.fps ?? undefined;

    // 4. Generate master playlist content with measured AVERAGE-BANDWIDTH (SDD §8.4, AC 6)
    const masterContent = generateMasterPlaylist({ ladder, fps, measuredResults });
    const masterKey = masterPlaylistKey(videoId, generation);
    const headers = getHeaderMapping('master.m3u8');

    // 4. AC 19: Master is written LAST (presence == READY)
    const uploaded = await storage.uploadObject({
      bucket: publicBucket,
      key: masterKey,
      body: masterContent,
      contentType: headers.contentType,
      cacheControl: headers.cacheControl,
    });
    if (isErr(uploaded)) return uploaded;

    const playbackUrl = `${cdn}/${masterKey}`;

    // 5. Complete step in DB with fencing token (AC 20)
    const comp = await repositories.steps.complete({
      videoId,
      step: 'package',
      rendition: '-',
      lockToken,
      result: { masterKey, playbackUrl },
    });

    if (isErr(comp)) return comp;

    if (comp.value.fenced) {
      log.warn(
        { lockToken, event: 'FENCED_OUT' },
        'Fenced out on package completion; not flipping video to READY'
      );
      return ok({ videoId, masterKey, playbackUrl });
    }

    // 6. AC 19: CAS-flip PROCESSING -> READY (happens once, writes video.ready event)
    const patch: Record<string, unknown> = {
      masterPlaylistKey: masterKey,
      readyAt: new Date(),
    };
    if (thumbResult?.posterKey) {
      patch['posterKey'] = thumbResult.posterKey;
    }
    if (thumbResult?.spriteKey) {
      patch['spriteKey'] = thumbResult.spriteKey;
    }

    const notifyJobId = ids.notify(videoId, 'video.ready', 1);
    const notifyJobData = video
      ? NotifyJob.parse({
          videoId,
          userId: video.ownerId,
          event: 'video.ready',
          eventSeq: 1,
          payload: { status: 'READY', playbackUrl },
          traceparent: job.data.traceparent,
        })
      : undefined;
    const notifyJobOpts = {
      jobId: notifyJobId,
      priority: job.opts?.priority,
      ...stagePolicies.notify,
      ...defaultJobOptions,
    };

    const transitionedResult = await repositories.videos.transition({
      videoId,
      from: 'PROCESSING',
      to: 'READY',
      eventType: 'video.ready',
      eventPayload: { playbackUrl, masterKey },
      patch,
      outbox: notifyJobData
        ? {
            kind: 'notify',
            payload: {
              type: 'queue',
              queueName: 'notify',
              job: { name: 'notify', data: notifyJobData, opts: notifyJobOpts },
            },
          }
        : undefined,
    });
    if (isErr(transitionedResult)) return transitionedResult;
    const transitioned = transitionedResult.value;

    log.info({ videoId, playbackUrl, transitioned }, 'Video transitioned to READY');

    // Record time_to_ready_seconds metric (Ticket 22 / SDD §13.1)
    if (transitioned && video) {
      const durationSec = (video.durationMs || 0) / MS_PER_SECOND;
      let bucket = '<1min';
      if (durationSec >= 900) {
        bucket = '15-60';
      } else if (durationSec >= 300) {
        bucket = '5-15';
      } else if (durationSec >= 60) {
        bucket = '1-5';
      }

      const createdAtTime = video.createdAt ? new Date(video.createdAt).getTime() : Date.now();
      const timeToReadySec = Math.max(0, (Date.now() - createdAtTime) / MS_PER_SECOND);
      getMetrics().timeToReady.observe({ bucket }, timeToReadySec);
    }

    // 7. Enqueue notify job if this was the successful CAS transition (AC 19, AC 20)
    if (transitioned && getQueue && notifyJobData) {
      const notifyQueue = getQueue('notify');
      const enqueued = await notifyQueue.add('notify', notifyJobData, notifyJobOpts);
      if (isErr(enqueued)) return enqueued;

      log.info(
        { notifyJobId, priority: job.opts?.priority },
        'Enqueued notify job for video.ready'
      );
    }

    return ok({ videoId, masterKey, playbackUrl });
  };
}

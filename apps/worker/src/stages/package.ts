import type { JobQueue, QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { MS_PER_SECOND } from '@vp/domain/time';
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
  ChildResult,
  type NotifyJob,
  type PackageJob,
  type ThumbnailResult,
  defaultJobOptions,
  ids,
  stagePolicies,
} from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, assertNever, err, isErr, ok, unwrapOr } from '@vp/result';
import { getHeaderMapping, masterPlaylistKey, renditionPlaylistKey } from '@vp/storage';
import { uuidv7 } from 'uuidv7';

export interface PackageProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  metrics: PipelineMetrics;
  publicBucket: string;
  cdn: CdnBase;
  workerId: string;
  logger: Logger;
  now: () => number;
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

/** A re-process packages generation 2 and up, long after the upload, so only the first is timed. */
const FIRST_GENERATION = 1;

/** The source-duration bands `time_to_ready_seconds` is split by (SDD §13.1). */
export function durationBucket(durationMs: number): '<1min' | '1-5' | '5-15' | '15-60' {
  const minutes = durationMs / MS_PER_SECOND / 60;
  if (minutes >= 15) return '15-60';
  if (minutes >= 5) return '5-15';
  if (minutes >= 1) return '1-5';
  return '<1min';
}

export function createPackageProcessor(deps: PackageProcessorDeps) {
  const { repositories, storage, metrics, publicBucket, cdn, workerId, logger, now, getQueue } =
    deps;

  return async function processPackageJob(
    job: QueueJob<PackageJob>
  ): Promise<Result<PackageStageResult, PackageStageFailure>> {
    const { videoId, generation, ladder } = job.data;
    const log = logger.child({
      videoId,
      jobId: job.id,
      stage: 'package',
      attempt: (job.attemptsMade ?? 0) + 1,
    });

    log.info({ ladder: ladder.map((r) => r.name) }, 'package job started');

    const lockToken = uuidv7();
    const claim = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'package',
      rendition: '-',
      jobId: job.id,
      attempt: (job.attemptsMade ?? 0) + 1,
      workerId,
      lockToken,
    });

    if (isErr(claim)) return claim;

    if (claim.value.fenced) {
      log.warn({ lockToken }, 'package step already completed; fenced out');
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

    const children = job.getChildrenValues ? await job.getChildrenValues() : {};
    const measuredResults: Record<
      string,
      { bytes?: number; durationMs?: number; avgBitrateBps?: number }
    > = {};
    let thumbResult: ThumbnailResult | undefined;

    for (const value of Object.values(children ?? {})) {
      const child = ChildResult.safeParse(value);
      if (!child.success) continue;

      switch (child.data.type) {
        case 'transcode': {
          const { rendition, bytes, durationMs, avgBitrateBps } = child.data;
          measuredResults[rendition] = { bytes, durationMs, avgBitrateBps };
          break;
        }
        case 'thumbnail':
          thumbResult = child.data;
          break;
        default:
          return assertNever(child.data, 'package child result');
      }
    }

    for (const r of ladder) {
      const rendKey = renditionPlaylistKey(videoId, r.name, generation);
      const head = await storage.headObject(publicBucket, rendKey);
      if (isErr(head)) return head;

      if (!head.value) {
        log.error({ rendKey }, 'rendition playlist missing');
        return failPackage(
          mediaFailure(
            'package',
            ErrorCodes.SEGMENT_VERIFY_FAILED,
            `Rendition playlist missing at ${rendKey}`
          )
        );
      }
    }

    const videoResult = await repositories.videos.findById(videoId);
    if (isErr(videoResult)) return videoResult;
    const video = videoResult.value;
    const fps = video?.fps ?? undefined;

    const masterContent = generateMasterPlaylist({ ladder, fps, measuredResults });
    const masterKey = masterPlaylistKey(videoId, generation);
    const headers = getHeaderMapping('master.m3u8');

    // The master is written last: its presence is what READY means to a player.
    const uploaded = await storage.uploadObject({
      bucket: publicBucket,
      key: masterKey,
      body: masterContent,
      contentType: headers.contentType,
      cacheControl: headers.cacheControl,
    });
    if (isErr(uploaded)) return uploaded;

    const playbackUrl = `${cdn}/${masterKey}`;

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
        'fenced out on package completion; not flipping video to READY'
      );
      return ok({ videoId, masterKey, playbackUrl });
    }

    const patch: Record<string, unknown> = {
      masterPlaylistKey: masterKey,
      readyAt: new Date(now()),
    };
    if (thumbResult?.posterKey) {
      patch['posterKey'] = thumbResult.posterKey;
    }
    if (thumbResult?.spriteKey) {
      patch['spriteKey'] = thumbResult.spriteKey;
    }

    const notifyJobId = ids.notify(videoId, 'video.ready', 1);
    const notifyJobData: NotifyJob | undefined = video
      ? {
          videoId,
          userId: video.ownerId,
          event: 'video.ready',
          eventSeq: 1,
          payload: { status: 'READY', playbackUrl },
          traceparent: job.data.traceparent,
          requestId: job.data.requestId,
        }
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

    log.info({ videoId, playbackUrl, transitioned }, 'video transitioned to READY');

    if (transitioned && video && generation === FIRST_GENERATION) {
      const upload = unwrapOr(await repositories.uploads.findByVideoId(videoId), null);
      if (upload?.completedAt) {
        metrics.timeToReady.observe(
          { bucket: durationBucket(video.durationMs ?? 0) },
          Math.max(0, (now() - upload.completedAt.getTime()) / MS_PER_SECOND)
        );
      }
    }

    if (transitioned && getQueue && notifyJobData) {
      const notifyQueue = getQueue('notify');
      const enqueued = await notifyQueue.add('notify', notifyJobData, notifyJobOpts);
      if (isErr(enqueued)) return enqueued;

      log.info(
        { notifyJobId, priority: job.opts?.priority },
        'enqueued notify job for video.ready'
      );
    }

    return ok({ videoId, masterKey, playbackUrl });
  };
}

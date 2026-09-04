import type { JobQueue, QueueJob, Repositories, StorageClient } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { generateMasterPlaylist } from '@vp/ffmpeg';
import {
  NotifyJob,
  type PackageJob,
  defaultJobOptions,
  ids,
  stagePolicies,
} from '@vp/job-contracts';
import type { Logger } from '@vp/observability';
import { getHeaderMapping, masterPlaylistKey, renditionPlaylistKey } from '@vp/storage';
import { uuidv7 } from 'uuidv7';
import { validateJobId } from '../registry.js';

export interface PackageProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  publicBucket?: string;
  cdnBaseUrl?: string;
  workerId?: string;
  logger: Logger;
  getQueue?: (name: string) => JobQueue;
}

export function createPackageProcessor(deps: PackageProcessorDeps) {
  const {
    repositories,
    storage,
    publicBucket = process.env['STORAGE_PUBLIC_BUCKET'] || 'public',
    cdnBaseUrl = process.env['CDN_BASE_URL'] || 'http://localhost:9000/public',
    workerId = `worker-${process.pid}`,
    logger,
    getQueue,
  } = deps;

  const cleanCdnBase = cdnBaseUrl.replace(/\/+$/, '');

  return async function processPackageJob(
    job: QueueJob<PackageJob>
  ): Promise<{ videoId: string; masterKey: string; playbackUrl: string }> {
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

    if (claim.fenced) {
      log.warn({ lockToken }, 'Package step already completed; fenced out');
      return {
        videoId,
        masterKey: masterPlaylistKey(videoId, generation),
        playbackUrl: `${cleanCdnBase}/${masterPlaylistKey(videoId, generation)}`,
      };
    }

    await repositories.steps.heartbeat(lockToken);

    try {
      // 2. Read children values from Flow transcode jobs (SDD §9.3, Ticket 12 AC 6)
      const rawChildren = job.getChildrenValues ? await job.getChildrenValues() : {};
      const childrenValues = rawChildren ? Object.values(rawChildren) : [];
      const measuredResults: Record<
        string,
        { bytes?: number; durationMs?: number; avgBitrateBps?: number }
      > = {};

      for (const val of childrenValues) {
        if (val && typeof val === 'object' && 'rendition' in val) {
          const res = val as any;
          measuredResults[res.rendition] = {
            bytes: res.bytes,
            durationMs: res.durationMs,
            avgBitrateBps: res.avgBitrateBps,
          };
        }
      }

      // 3. AC 19: Verify every rendition playlist exists via HEAD before writing master
      for (const r of ladder) {
        const rendKey = renditionPlaylistKey(videoId, r.name, generation);
        const head = await storage.headObject(publicBucket, rendKey);
        if (!head) {
          const errorMsg = `Rendition playlist missing at ${rendKey}`;
          log.error({ rendKey }, errorMsg);
          await repositories.steps.fail({
            videoId,
            step: 'package',
            rendition: '-',
            lockToken,
            errorCode: ErrorCodes.SEGMENT_VERIFY_FAILED,
            errorMessage: errorMsg,
          });
          throw new PermanentError(ErrorCodes.SEGMENT_VERIFY_FAILED, errorMsg);
        }
      }

      // Query video metadata for fps
      const video = await repositories.videos.findById(videoId);
      const fps = (video as any)?.fps ?? 24;

      // 4. Generate master playlist content with measured AVERAGE-BANDWIDTH (SDD §8.4, AC 6)
      const masterContent = generateMasterPlaylist({ ladder, fps, measuredResults });
      const masterKey = masterPlaylistKey(videoId, generation);
      const headers = getHeaderMapping('master.m3u8');

      // 4. AC 19: Master is written LAST (presence == READY)
      await storage.uploadObject({
        bucket: publicBucket,
        key: masterKey,
        body: masterContent,
        contentType: headers.contentType,
        cacheControl: headers.cacheControl,
      });

      const playbackUrl = `${cleanCdnBase}/${masterKey}`;

      // 5. Complete step in DB with fencing token (AC 20)
      const comp = await repositories.steps.complete({
        videoId,
        step: 'package',
        rendition: '-',
        lockToken,
        result: { masterKey, playbackUrl },
      });

      if (comp.fenced) {
        log.warn(
          { lockToken, event: 'FENCED_OUT' },
          'Fenced out on package completion; not flipping video to READY'
        );
        return { videoId, masterKey, playbackUrl };
      }

      // 6. AC 19: CAS-flip PROCESSING -> READY (happens once, writes video.ready event)
      const transitioned = await repositories.videos.transition({
        videoId,
        from: 'PROCESSING',
        to: 'READY',
        eventType: 'video.ready',
        eventPayload: { playbackUrl, masterKey },
        patch: {
          masterPlaylistKey: masterKey,
          readyAt: new Date(),
        },
      });

      log.info({ videoId, playbackUrl, transitioned }, 'Video transitioned to READY');

      // 7. Enqueue notify job if this was the successful CAS transition (AC 19, AC 20)
      if (transitioned && getQueue && video) {
        const notifyQueue = getQueue('notify');
        const notifyJobId = ids.notify(videoId, 'video.ready', 1);

        await notifyQueue.add(
          'notify',
          NotifyJob.parse({
            videoId,
            userId: video.ownerId,
            event: 'video.ready',
            eventSeq: 1,
            payload: { status: 'READY', playbackUrl },
            traceparent: job.data.traceparent,
          }),
          {
            jobId: notifyJobId,
            ...stagePolicies.notify,
            ...defaultJobOptions,
          }
        );
        log.info({ notifyJobId }, 'Enqueued notify job for video.ready');
      }

      return { videoId, masterKey, playbackUrl };
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'Package failed';
      const isPermanent = err instanceof PermanentError;

      await repositories.steps.fail({
        videoId,
        step: 'package',
        rendition: '-',
        lockToken,
        errorCode: isPermanent ? (err as PermanentError).code : ErrorCodes.INTERNAL,
        errorMessage: errorMsg,
      });

      throw err;
    }
  };
}

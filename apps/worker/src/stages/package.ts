import {
  type Database,
  claimStep,
  completeStep,
  failStep,
  heartbeatStep,
  transitionVideo,
  videos,
} from '@vp/db';
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
import {
  type S3Client,
  getHeaderMapping,
  headObject,
  masterPlaylistKey,
  renditionPlaylistKey,
  uploadObject,
} from '@vp/storage';
import { type Job, type Queue, UnrecoverableError } from 'bullmq';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { validateJobId } from '../registry.js';

export interface PackageProcessorDeps {
  db: Database;
  s3Client: S3Client;
  publicBucket?: string;
  cdnBaseUrl?: string;
  workerId?: string;
  logger: Logger;
  getQueue?: (name: string) => Queue;
}

export function createPackageProcessor(deps: PackageProcessorDeps) {
  const {
    db,
    s3Client,
    publicBucket = process.env.STORAGE_PUBLIC_BUCKET || 'public',
    cdnBaseUrl = process.env.CDN_BASE_URL || 'http://localhost:9000/public',
    workerId = `worker-${process.pid}`,
    logger,
    getQueue,
  } = deps;

  const cleanCdnBase = cdnBaseUrl.replace(/\/+$/, '');

  return async function processPackageJob(
    job: Job<PackageJob>
  ): Promise<{ videoId: string; masterKey: string; playbackUrl: string }> {
    validateJobId(job.id || '');

    const { videoId, generation, ladder } = job.data;
    const log = logger.child({
      videoId,
      jobId: job.id,
      stage: 'package',
      attempt: job.attemptsMade + 1,
    });

    log.info({ ladder: ladder.map((r) => r.name) }, 'Package job started');

    // 1. Claim processing step (SDD §5.3, §9.5, AC 20)
    const lockToken = uuidv7();
    const claim = await claimStep(db, {
      id: uuidv7(),
      videoId,
      step: 'package',
      rendition: '-',
      jobId: job.id || '',
      attempt: job.attemptsMade + 1,
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

    await heartbeatStep(db, lockToken);

    try {
      // 2. AC 19: Verify every rendition playlist exists via HEAD before writing master
      for (const r of ladder) {
        const rendKey = renditionPlaylistKey(videoId, r.name, generation);
        const head = await headObject(s3Client, publicBucket, rendKey);
        if (!head) {
          const errorMsg = `Rendition playlist missing at ${rendKey}`;
          log.error({ rendKey }, errorMsg);
          await failStep(db, {
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
      const [video] = await db.select().from(videos).where(eq(videos.id, videoId));
      const fps = video?.fps ? Number.parseFloat(video.fps) : 24;

      // 3. Generate master playlist content (SDD §8.4)
      const masterContent = generateMasterPlaylist({ ladder, fps });
      const masterKey = masterPlaylistKey(videoId, generation);
      const headers = getHeaderMapping('master.m3u8');

      // 4. AC 19: Master is written LAST (presence == READY)
      await uploadObject(s3Client, {
        bucket: publicBucket,
        key: masterKey,
        body: masterContent,
        contentType: headers.contentType,
        cacheControl: headers.cacheControl,
      });

      const playbackUrl = `${cleanCdnBase}/${masterKey}`;

      // 5. Complete step in DB with fencing token (AC 20)
      const comp = await completeStep(db, {
        videoId,
        step: 'package',
        rendition: '-',
        lockToken,
        result: { masterKey, playbackUrl },
      });

      if (comp.fenced) {
        log.warn({ lockToken }, 'Fenced out on package completion; not flipping video to READY');
        return { videoId, masterKey, playbackUrl };
      }

      // 6. AC 19: CAS-flip PROCESSING -> READY (happens once, writes video.ready event)
      const transitioned = await transitionVideo(db, {
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

      await failStep(db, {
        videoId,
        step: 'package',
        rendition: '-',
        lockToken,
        errorCode: isPermanent ? (err as PermanentError).code : ErrorCodes.INTERNAL,
        errorMessage: errorMsg,
      });

      if (isPermanent) {
        throw new UnrecoverableError(errorMsg);
      }
      throw err;
    }
  };
}

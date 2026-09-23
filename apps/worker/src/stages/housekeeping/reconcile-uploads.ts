import type { JobQueue, MultipartStorage } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { defaultJobOptions, ids, stagePolicies } from '@vp/job-contracts';
import { type Logger, getMetrics } from '@vp/observability';
import { type Result, isErr, ok, unwrapOr } from '@vp/result';

export interface ReconcileUploadsOptions {
  repositories: Repositories;
  multipart?: MultipartStorage;
  probeQueue?: JobQueue;
  rawBucket: string;
  uploadingThresholdMs?: number;
  uploadedThresholdMs?: number;
  maxInflightPerUser: number;
  logger?: Logger;
}

export interface ReconcileUploadsResult {
  abandonedCount: number;
  reenqueuedCount: number;
}

/**
 * Reconciler for upload lifecycle (SDD §9.8, §5.3, ADR-09, ADR-16):
 * 1. Abort uploads stuck in UPLOADING for > threshold (default 24h) -> ABANDONED, abort multipart.
 * 2. Re-enqueue videos left UPLOADED with no probe step for > threshold (default 5m) -> probe job.
 *    Only releases videos if owner's active in-flight count < MAX_INFLIGHT_PER_USER (Ticket 18).
 */
export async function runReconcileUploads(
  options: ReconcileUploadsOptions
): Promise<Result<ReconcileUploadsResult, DatabaseUnavailable>> {
  const {
    repositories,
    multipart,
    probeQueue,
    rawBucket,
    uploadingThresholdMs = 24 * 60 * 60 * 1000,
    uploadedThresholdMs = 5 * 60 * 1000,
    maxInflightPerUser,
    logger,
  } = options;

  let abandonedCount = 0;
  let reenqueuedCount = 0;

  // 1. Stale UPLOADING -> ABANDONED
  const staleUploading = await repositories.videos.scan({
    status: 'UPLOADING',
    idleFor: { since: 'updatedAt', ms: uploadingThresholdMs },
  });
  if (isErr(staleUploading)) return staleUploading;

  for (const video of staleUploading.value) {
    const transitioned = await repositories.videos.transition({
      videoId: video.id,
      from: 'UPLOADING',
      to: 'ABANDONED',
      eventType: 'video.abandoned',
      eventPayload: { reason: 'stale_upload_timeout', thresholdMs: uploadingThresholdMs },
    });
    if (isErr(transitioned)) return transitioned;

    if (transitioned.value) {
      abandonedCount += 1;
      logger?.info({ videoId: video.id }, 'Reconciler abandoned stale UPLOADING video');

      // Check upload record to abort multipart if active
      const upload = unwrapOr(await repositories.uploads.findByVideoId(video.id), null);
      if (upload) {
        await repositories.uploads.updateStatus(upload.id, 'ABORTED');
        if (upload.multipartUploadId && multipart) {
          // A session that storage will expire on its own is not worth holding the sweep for.
          const aborted = await multipart.abortMultipartUpload(
            rawBucket,
            video.sourceKey,
            upload.multipartUploadId
          );
          logger?.[isErr(aborted) ? 'warn' : 'info'](
            { videoId: video.id, uploadId: upload.multipartUploadId },
            isErr(aborted)
              ? 'Failed to abort multipart upload on storage'
              : 'Aborted multipart upload on storage'
          );
        }
      }
    }
  }

  // 2. Stale UPLOADED without probe step -> re-enqueue probe if under in-flight limit
  const staleUploaded = await repositories.videos.scan({
    status: 'UPLOADED',
    idleFor: { since: 'updatedAt', ms: uploadedThresholdMs },
    without: { type: 'step', step: 'probe' },
  });
  if (isErr(staleUploaded)) return staleUploaded;

  const ownerInflightCounts = new Map<string, number>();

  for (const video of staleUploaded.value) {
    if (probeQueue) {
      let currentInflight = ownerInflightCounts.get(video.ownerId);
      if (currentInflight === undefined) {
        const counted = await repositories.videos.countInFlightByOwner(video.ownerId);
        if (isErr(counted)) return counted;

        currentInflight = counted.value;
        ownerInflightCounts.set(video.ownerId, currentInflight);
      }

      if (currentInflight >= maxInflightPerUser) {
        logger?.info(
          { videoId: video.id, ownerId: video.ownerId, currentInflight, maxInflightPerUser },
          'Reconciler skipping held video: owner in-flight limit reached'
        );
        continue;
      }

      let priority = 5;
      if (repositories.users) {
        // A tier lookup that cannot answer costs the job its priority, not its admission.
        const user = unwrapOr(await repositories.users.findById(video.ownerId), null);
        if (user?.tier === 'pro' || user?.tier === 'enterprise') {
          priority = 1;
        }
      }

      const probeJobId = ids.probe(video.id, video.generation ?? 1);
      await probeQueue.add(
        'probe',
        {
          videoId: video.id,
          sourceKey: video.sourceKey,
          generation: video.generation ?? 1,
          traceparent: '00-00000000000000000000000000000001-0000000000000001-01',
        },
        {
          jobId: probeJobId,
          ...stagePolicies.probe,
          ...defaultJobOptions,
          priority,
        }
      );

      ownerInflightCounts.set(video.ownerId, currentInflight + 1);
      reenqueuedCount += 1;
      getMetrics().reconcilerRepairsTotal.inc({ type: 'missing_probe' });
      logger?.info(
        { videoId: video.id, probeJobId, priority },
        'Reconciler released held video and enqueued probe job'
      );
    }
  }

  return ok({ abandonedCount, reenqueuedCount });
}

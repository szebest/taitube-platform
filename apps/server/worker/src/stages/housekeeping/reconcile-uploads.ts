import type { JobQueue, MultipartStorage } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { jobPriorityFor } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { defaultJobOptions, ids, stagePolicies } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { type PipelineMetrics, rootTraceparent } from '@vp/observability';
import { type Result, isErr, ok, unwrapOr } from '@vp/result';

export interface ReconcileUploadsOptions {
  repositories: Repositories;
  multipart: MultipartStorage;
  probeQueue: JobQueue;
  metrics: PipelineMetrics;
  rawBucket: string;
  uploadingThresholdMs: number;
  uploadedThresholdMs: number;
  scanLimit: number;
  maxInflightPerUser: number;
  logger?: Logger;
}

export interface ReconcileUploadsResult {
  abandonedCount: number;
  reenqueuedCount: number;
}

/**
 * Abandons uploads stuck in UPLOADING, aborting their multipart session, and re-enqueues the probe
 * of a video left UPLOADED with no probe step, while its owner is under the in-flight limit
 * (SDD §9.8, §5.3, ADR-09, ADR-16).
 */
export async function runReconcileUploads(
  options: ReconcileUploadsOptions
): Promise<Result<ReconcileUploadsResult, DatabaseUnavailable>> {
  const {
    repositories,
    multipart,
    probeQueue,
    metrics,
    rawBucket,
    uploadingThresholdMs,
    uploadedThresholdMs,
    scanLimit,
    maxInflightPerUser,
    logger,
  } = options;

  let abandonedCount = 0;
  let reenqueuedCount = 0;

  const staleUploading = await repositories.videos.scan({
    status: 'UPLOADING',
    idleFor: { since: 'updatedAt', ms: uploadingThresholdMs },
    limit: scanLimit,
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
      logger?.info({ videoId: video.id }, 'reconciler abandoned stale UPLOADING video');

      const upload = unwrapOr(await repositories.uploads.findByVideoId(video.id), null);
      if (upload) {
        const marked = await repositories.uploads.updateStatus(upload.id, 'ABORTED');
        if (isErr(marked)) return marked;
        if (upload.multipartUploadId) {
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

  const staleUploaded = await repositories.videos.scan({
    status: 'UPLOADED',
    idleFor: { since: 'updatedAt', ms: uploadedThresholdMs },
    without: { type: 'step', step: 'probe' },
    limit: scanLimit,
  });
  if (isErr(staleUploaded)) return staleUploaded;

  const ownerInflightCounts = new Map<string, number>();

  for (const video of staleUploaded.value) {
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
        'reconciler skipping held video: owner in-flight limit reached'
      );
      continue;
    }

    const priority = jobPriorityFor(
      unwrapOr(await repositories.users.findById(video.ownerId), null)?.tier
    );

    const probeJobId = ids.probe(video.id, video.generation ?? 1);
    const enqueued = await probeQueue.add(
      'probe',
      {
        videoId: video.id,
        sourceKey: video.sourceKey,
        generation: video.generation ?? 1,
        traceparent: rootTraceparent('housekeeping.reconcile-uploads.repair'),
      },
      {
        jobId: probeJobId,
        ...stagePolicies.probe,
        ...defaultJobOptions,
        priority,
      }
    );
    if (isErr(enqueued)) {
      logger?.warn(
        { videoId: video.id, probeJobId, queue: enqueued.error.operation },
        'reconciler could not re-enqueue the probe; the video is kept for the next run'
      );
      continue;
    }

    ownerInflightCounts.set(video.ownerId, currentInflight + 1);
    reenqueuedCount += 1;
    metrics.reconcilerRepairsTotal.inc({ type: 'missing_probe' });
    logger?.info(
      { videoId: video.id, probeJobId, priority },
      'reconciler released held video and enqueued probe job'
    );
  }

  return ok({ abandonedCount, reenqueuedCount });
}

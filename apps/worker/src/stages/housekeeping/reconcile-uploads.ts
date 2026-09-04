import type { JobQueue, MultipartStorage, Repositories } from '@vp/core/ports';
import { defaultJobOptions, ids, stagePolicies } from '@vp/job-contracts';
import type { Logger } from '@vp/observability';

export interface ReconcileUploadsOptions {
  repositories: Repositories;
  multipart?: MultipartStorage;
  probeQueue?: JobQueue;
  rawBucket?: string;
  uploadingThresholdMs?: number;
  uploadedThresholdMs?: number;
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
 */
export async function runReconcileUploads(
  options: ReconcileUploadsOptions
): Promise<ReconcileUploadsResult> {
  const {
    repositories,
    multipart,
    probeQueue,
    rawBucket = process.env['STORAGE_RAW_BUCKET'] ?? 'raw',
    uploadingThresholdMs = process.env['RECONCILE_UPLOADING_THRESHOLD_MS']
      ? Number.parseInt(process.env['RECONCILE_UPLOADING_THRESHOLD_MS'], 10)
      : 24 * 60 * 60 * 1000,
    uploadedThresholdMs = process.env['RECONCILE_UPLOADED_THRESHOLD_MS']
      ? Number.parseInt(process.env['RECONCILE_UPLOADED_THRESHOLD_MS'], 10)
      : 5 * 60 * 1000,
    logger,
  } = options;

  let abandonedCount = 0;
  let reenqueuedCount = 0;

  // 1. Stale UPLOADING -> ABANDONED
  const staleUploading = await repositories.videos.findStaleUploading(uploadingThresholdMs);
  for (const video of staleUploading) {
    const transitioned = await repositories.videos.transition({
      videoId: video.id,
      from: 'UPLOADING',
      to: 'ABANDONED',
      eventType: 'video.abandoned',
      eventPayload: { reason: 'stale_upload_timeout', thresholdMs: uploadingThresholdMs },
    });

    if (transitioned) {
      abandonedCount += 1;
      logger?.info({ videoId: video.id }, 'Reconciler abandoned stale UPLOADING video');

      // Check upload record to abort multipart if active
      const upload = await repositories.uploads.findByVideoId(video.id);
      if (upload) {
        await repositories.uploads.updateStatus(upload.id, 'ABORTED');
        if (upload.multipartUploadId && multipart) {
          try {
            await multipart.abortMultipartUpload(
              rawBucket,
              video.sourceKey,
              upload.multipartUploadId
            );
            logger?.info(
              { videoId: video.id, uploadId: upload.multipartUploadId },
              'Aborted multipart upload on storage'
            );
          } catch (err: unknown) {
            logger?.warn(
              { videoId: video.id, err: (err as Error).message },
              'Failed to abort multipart upload on storage'
            );
          }
        }
      }
    }
  }

  // 2. Stale UPLOADED without probe step -> re-enqueue probe
  const staleUploaded =
    await repositories.videos.findStaleUploadedWithoutProbe(uploadedThresholdMs);
  for (const video of staleUploaded) {
    if (probeQueue) {
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
        }
      );

      reenqueuedCount += 1;
      logger?.info({ videoId: video.id, probeJobId }, 'Reconciler re-enqueued missing probe job');
    }
  }

  return { abandonedCount, reenqueuedCount };
}

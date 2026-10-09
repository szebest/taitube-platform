import type { UploadRecord, VideoRecord } from '@vp/core/repositories';
import { jobPriorityFor } from '@vp/domain';
import {
  type NotMultipart,
  type PartManifestMismatch,
  type SourceMissing,
  type UploadOpenFailure,
  type UploadPart,
  type UploadSizeMismatch,
  decidePartManifest,
  decideSizeMatch,
  decideUploadOpen,
  notMultipart,
  sourceMissing,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes, type StorageUnavailable } from '@vp/errors';
import { createTraceparent, getActiveTraceparent } from '@vp/observability';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, ok, unwrapOr } from '@vp/result';
import { type DispatchOrigin, buildProbeDispatch, enqueueProbe } from './probe-dispatch';
import { type LoadOwnedUploadFailure, type UploadContext, loadOwnedUpload } from './upload-context';

export interface CompleteUploadResult {
  videoId: string;
  status: string;
  admission?: 'admitted' | 'held';
}

export type CompleteUploadFailure =
  | LoadOwnedUploadFailure
  | UploadOpenFailure
  | NotMultipart
  | PartManifestMismatch
  | SourceMissing
  | UploadSizeMismatch
  | StorageUnavailable
  | DatabaseUnavailable;

async function finishMultipart(
  ctx: UploadContext,
  upload: UploadRecord,
  video: VideoRecord,
  parts?: readonly UploadPart[]
): Promise<Result<void, PartManifestMismatch | NotMultipart | StorageUnavailable>> {
  const manifest = decidePartManifest({ upload, parts });
  if (isErr(manifest)) return manifest;
  if (!upload.multipartUploadId) return err(notMultipart(upload.id));

  return ctx.multipart.completeMultipartUpload(
    ctx.rawBucket,
    video.sourceKey,
    upload.multipartUploadId,
    manifest.value
  );
}

/**
 * A size that disagrees with what the client declared means the object is not
 * what was authorised, so it is removed rather than left for the probe stage.
 */
async function rejectSizeMismatch(
  ctx: UploadContext,
  uploadId: string,
  video: VideoRecord,
  mismatch: UploadSizeMismatch
): Promise<Result<never, UploadSizeMismatch | StorageUnavailable | DatabaseUnavailable>> {
  const { actualSizeBytes } = mismatch;
  const removed = await ctx.storage.deleteObject(ctx.rawBucket, video.sourceKey);
  if (isErr(removed)) return removed;

  const aborted = await ctx.uploads.updateStatus(uploadId, 'ABORTED');
  if (isErr(aborted)) return aborted;

  const transitioned = await ctx.videos.transition({
    videoId: video.id,
    from: 'UPLOADING',
    to: 'REJECTED',
    eventType: 'upload.rejected',
    eventPayload: {
      declaredSizeBytes: mismatch.declaredSizeBytes,
      actualSizeBytes,
      reason: 'Uploaded size does not match declared size',
    },
    patch: {
      errorCode: ErrorCodes.UPLOAD_SIZE_MISMATCH,
      errorMessage: `Declared size ${mismatch.declaredSizeBytes} bytes but received ${actualSizeBytes} bytes`,
    },
  });
  if (isErr(transitioned)) return transitioned;

  return err(mismatch);
}

/**
 * Completes an upload, verifies the stored object, CAS-transitions the video to
 * UPLOADED and enqueues the probe job the same transition committed to the outbox.
 */
export async function completeUpload(
  ctx: UploadContext,
  user: UserContext,
  uploadId: string,
  parts?: readonly UploadPart[],
  origin: DispatchOrigin = {}
): Promise<Result<CompleteUploadResult, CompleteUploadFailure>> {
  const owned = await loadOwnedUpload(ctx, user, uploadId, 'complete this upload');
  if (isErr(owned)) return owned;

  const { upload, video } = owned.value;
  if (video.status !== 'UPLOADING') return ok({ videoId: video.id, status: video.status });

  const open = decideUploadOpen({ upload, now: new Date() });
  if (isErr(open)) return open;

  if (upload.strategy === 'multipart') {
    const finished = await finishMultipart(ctx, upload, video, parts);
    if (isErr(finished)) return finished;
  }

  const head = await ctx.storage.headObject(ctx.rawBucket, video.sourceKey);
  if (isErr(head)) return head;
  if (!head.value) return err(sourceMissing(video.id, video.sourceKey));

  const size = decideSizeMatch({ video, actualSizeBytes: head.value.contentLength });
  if (isErr(size)) return rejectSizeMismatch(ctx, uploadId, video, size.error);
  const actualSizeBytes = size.value;

  const completed = await ctx.uploads.updateStatus(uploadId, 'COMPLETED');
  if (isErr(completed)) return completed;

  const traceparent = getActiveTraceparent() ?? createTraceparent();

  const dispatch = buildProbeDispatch({
    videoId: video.id,
    sourceKey: video.sourceKey,
    generation: 1,
    traceparent,
    requestId: origin.requestId,
    priority: jobPriorityFor(unwrapOr(await ctx.users.findById(video.ownerId), null)?.tier),
  });

  const transitioned = await ctx.videos.transition({
    videoId: video.id,
    from: 'UPLOADING',
    to: 'UPLOADED',
    eventType: 'upload.completed',
    eventPayload: { uploadId, sizeBytes: actualSizeBytes },
    traceId: traceparent.split('-')[1],
    outbox: dispatch.outbox,
  });
  if (isErr(transitioned)) return transitioned;
  if (!transitioned.value) return ok({ videoId: video.id, status: 'UPLOADED' });

  // Admission cannot be decided without the count, so a failed count holds the video rather than
  // admitting it (SDD §9.4, PRD FR-13): the outbox relay drains a held video anyway, so holding
  // costs latency, not a job.
  const inFlight = unwrapOr(
    await ctx.videos.countInFlightByOwner(video.ownerId),
    Number.MAX_SAFE_INTEGER
  );
  if (inFlight >= ctx.maxInflightPerUser) {
    return ok({ videoId: video.id, status: 'UPLOADED', admission: 'held' });
  }

  await enqueueProbe(ctx.probeQueue, dispatch);

  return ok({ videoId: video.id, status: 'UPLOADED', admission: 'admitted' });
}

import type { UploadRecord, VideoRecord } from '@vp/core/repositories';
import { ErrorCodes, PermanentError, toPipelineError } from '@vp/errors';
import { createTraceparent, getActiveSpanContext, getActiveTraceparent } from '@vp/observability';
import { isErr, unwrapOr } from '@vp/result';
import type { AuthUser } from '../plugins/auth';
import { buildProbeDispatch, enqueueProbe } from './probe-dispatch';
import { type UploadContext, loadOwnedUpload } from './upload-context';

const PRIORITY_PAID = 1;
const PRIORITY_FREE = 5;

export interface UploadPart {
  partNumber: number;
  etag: string;
}

export interface CompleteUploadOptions {
  testCrashAfterCommit?: boolean;
}

export interface CompleteUploadResult {
  videoId: string;
  status: string;
  admission?: 'admitted' | 'held';
}

async function finishMultipart(
  ctx: UploadContext,
  upload: UploadRecord,
  video: VideoRecord,
  parts?: UploadPart[]
): Promise<void> {
  if (!parts || parts.length === 0) {
    throw new PermanentError(
      ErrorCodes.VALIDATION_FAILED,
      'Missing parts list required to complete multipart upload'
    );
  }

  if (parts.length !== upload.partsExpected) {
    throw new PermanentError(
      ErrorCodes.VALIDATION_FAILED,
      `Expected ${upload.partsExpected} parts but received ${parts.length}`
    );
  }

  if (!upload.multipartUploadId) {
    throw new PermanentError(
      ErrorCodes.VALIDATION_FAILED,
      'Upload record is missing multipart upload ID'
    );
  }

  try {
    await ctx.multipart.completeMultipartUpload(
      ctx.rawBucket,
      video.sourceKey,
      upload.multipartUploadId,
      parts
    );
  } catch (err) {
    throw new PermanentError(
      ErrorCodes.VALIDATION_FAILED,
      `Failed to complete multipart upload: ${(err as Error).message}`
    );
  }
}

/**
 * A size that disagrees with what the client declared means the object is not
 * what was authorised, so it is removed rather than left for the probe stage.
 */
async function rejectSizeMismatch(
  ctx: UploadContext,
  uploadId: string,
  video: VideoRecord,
  actualSizeBytes: number
): Promise<never> {
  await ctx.storage.deleteObject(ctx.rawBucket, video.sourceKey);
  await ctx.uploads.updateStatus(uploadId, 'ABORTED');

  await ctx.videos.transition({
    videoId: video.id,
    from: 'UPLOADING',
    to: 'REJECTED',
    eventType: 'upload.rejected',
    eventPayload: {
      declaredSizeBytes: video.sourceSizeBytes,
      actualSizeBytes,
      reason: 'Uploaded size does not match declared size',
    },
    patch: {
      errorCode: ErrorCodes.UPLOAD_SIZE_MISMATCH,
      errorMessage: `Declared size ${video.sourceSizeBytes} bytes but received ${actualSizeBytes} bytes`,
    },
  });

  throw new PermanentError(
    ErrorCodes.UPLOAD_SIZE_MISMATCH,
    `Uploaded object size (${actualSizeBytes}) does not match declared size (${video.sourceSizeBytes})`
  );
}

async function probePriority(ctx: UploadContext, user: AuthUser, ownerId: string): Promise<number> {
  if (ctx.users) {
    // A tier lookup that cannot answer costs the job its priority, not its admission.
    const record = unwrapOr(await ctx.users.findById(ownerId), null);
    return record?.tier === 'pro' || record?.tier === 'enterprise' ? PRIORITY_PAID : PRIORITY_FREE;
  }
  return (user as { tier?: string }).tier === 'pro' ? PRIORITY_PAID : PRIORITY_FREE;
}

/**
 * Completes an upload, verifies the stored object, CAS-transitions the video to
 * UPLOADED and enqueues the probe job the same transition committed to the outbox.
 */
export async function completeUpload(
  ctx: UploadContext,
  user: AuthUser,
  uploadId: string,
  parts?: UploadPart[],
  options?: CompleteUploadOptions
): Promise<CompleteUploadResult> {
  const { upload, video } = await loadOwnedUpload(ctx, user, uploadId, 'complete this upload');

  if (video.status !== 'UPLOADING') {
    return { videoId: video.id, status: video.status };
  }

  if (upload.status === 'ABORTED') {
    throw new PermanentError(ErrorCodes.UPLOAD_NOT_OPEN, 'Upload was aborted');
  }

  if (upload.strategy === 'multipart') {
    await finishMultipart(ctx, upload, video, parts);
  }

  const head = await ctx.storage.headObject(ctx.rawBucket, video.sourceKey);
  if (!head) {
    throw new PermanentError(
      ErrorCodes.SOURCE_MISSING,
      `Source file not found at ${video.sourceKey}`
    );
  }

  if (video.sourceSizeBytes && head.contentLength !== video.sourceSizeBytes) {
    await rejectSizeMismatch(ctx, uploadId, video, head.contentLength);
  }

  await ctx.uploads.updateStatus(uploadId, 'COMPLETED');

  const activeCtx = getActiveSpanContext();
  const traceparent = activeCtx.traceparent || getActiveTraceparent() || createTraceparent();

  const dispatch = buildProbeDispatch({
    videoId: video.id,
    sourceKey: video.sourceKey,
    generation: 1,
    traceparent,
    priority: await probePriority(ctx, user, video.ownerId),
  });

  const transitioned = await ctx.videos.transition({
    videoId: video.id,
    from: 'UPLOADING',
    to: 'UPLOADED',
    eventType: 'upload.completed',
    eventPayload: { uploadId, sizeBytes: head.contentLength },
    traceId: activeCtx.traceId || traceparent.split('-')[1],
    outbox: dispatch.outbox,
  });

  if (isErr(transitioned)) throw toPipelineError(transitioned.error);
  if (!transitioned.value) {
    return { videoId: video.id, status: 'UPLOADED' };
  }

  // Deliberate crash point between the commit and the direct enqueue, so a test can
  // prove the outbox relay still publishes the job on its own.
  if (options?.testCrashAfterCommit) {
    throw new Error('CRASH_AFTER_COMMIT');
  }

  // Admission cannot be decided without the count, so a failed count holds the video rather than
  // admitting it (SDD §9.4, PRD FR-13): the outbox relay drains a held video anyway, so holding
  // costs latency, not a job.
  const inFlight = unwrapOr(
    await ctx.videos.countInFlightByOwner(video.ownerId),
    Number.MAX_SAFE_INTEGER
  );
  if (inFlight >= ctx.maxInflightPerUser) {
    return { videoId: video.id, status: 'UPLOADED', admission: 'held' };
  }

  await enqueueProbe(ctx.probeQueue, dispatch);

  return { videoId: video.id, status: 'UPLOADED', admission: 'admitted' };
}

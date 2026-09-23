import type { UploadRecord, VideoRecord } from '@vp/core/repositories';
import {
  type NotMultipart,
  type PartManifestMismatch,
  type SourceMissing,
  type UploadOpenFailure,
  type UploadSizeMismatch,
  decideUploadOpen,
  notMultipart,
  partManifestMismatch,
  sourceMissing,
  uploadSizeMismatch,
} from '@vp/domain-rules';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type Failure,
  type QueueUnavailable,
  type StorageUnavailable,
} from '@vp/errors';
import { createTraceparent, getActiveSpanContext, getActiveTraceparent } from '@vp/observability';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, map, ok, unwrapOr } from '@vp/result';
import { buildProbeDispatch, enqueueProbe } from './probe-dispatch';
import { type LoadOwnedUploadFailure, type UploadContext, loadOwnedUpload } from './upload-context';

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

/**
 * The deliberate failure point between the commit and the direct enqueue, so a test can prove the
 * outbox relay still publishes the job on its own.
 */
export type CrashedAfterCommit = Failure<typeof ErrorCodes.INTERNAL, Record<never, never>>;

const CRASHED_AFTER_COMMIT: CrashedAfterCommit = {
  code: ErrorCodes.INTERNAL,
  message: 'CRASH_AFTER_COMMIT',
};

export type CompleteUploadFailure =
  | CrashedAfterCommit
  | LoadOwnedUploadFailure
  | UploadOpenFailure
  | NotMultipart
  | PartManifestMismatch
  | SourceMissing
  | UploadSizeMismatch
  | StorageUnavailable
  | DatabaseUnavailable
  | QueueUnavailable;

async function finishMultipart(
  ctx: UploadContext,
  upload: UploadRecord,
  video: VideoRecord,
  parts?: UploadPart[]
): Promise<Result<void, PartManifestMismatch | NotMultipart | StorageUnavailable>> {
  const received = parts?.length ?? 0;
  if (received === 0 || upload.partsExpected === null || received !== upload.partsExpected) {
    return err(partManifestMismatch(upload.id, upload.partsExpected, received));
  }
  if (!upload.multipartUploadId) return err(notMultipart(upload.id));

  return map(
    await ctx.multipart.completeMultipartUpload(
      ctx.rawBucket,
      video.sourceKey,
      upload.multipartUploadId,
      parts as UploadPart[]
    ),
    () => undefined
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
  actualSizeBytes: number
): Promise<Result<never, UploadSizeMismatch | StorageUnavailable | DatabaseUnavailable>> {
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
      declaredSizeBytes: video.sourceSizeBytes,
      actualSizeBytes,
      reason: 'Uploaded size does not match declared size',
    },
    patch: {
      errorCode: ErrorCodes.UPLOAD_SIZE_MISMATCH,
      errorMessage: `Declared size ${video.sourceSizeBytes} bytes but received ${actualSizeBytes} bytes`,
    },
  });
  if (isErr(transitioned)) return transitioned;

  return err(uploadSizeMismatch(video.id, video.sourceSizeBytes ?? null, actualSizeBytes));
}

/** A tier lookup that cannot answer costs the job its priority, not its admission. */
async function probePriority(ctx: UploadContext, ownerId: string): Promise<number> {
  const record = unwrapOr(await ctx.users.findById(ownerId), null);
  return record?.tier === 'pro' || record?.tier === 'enterprise' ? PRIORITY_PAID : PRIORITY_FREE;
}

/**
 * Completes an upload, verifies the stored object, CAS-transitions the video to
 * UPLOADED and enqueues the probe job the same transition committed to the outbox.
 */
export async function completeUpload(
  ctx: UploadContext,
  user: UserContext,
  uploadId: string,
  parts?: UploadPart[],
  options?: CompleteUploadOptions
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

  const actualSizeBytes = head.value.contentLength;
  if (video.sourceSizeBytes && actualSizeBytes !== video.sourceSizeBytes) {
    return rejectSizeMismatch(ctx, uploadId, video, actualSizeBytes);
  }

  const completed = await ctx.uploads.updateStatus(uploadId, 'COMPLETED');
  if (isErr(completed)) return completed;

  const activeCtx = getActiveSpanContext();
  const traceparent = activeCtx.traceparent || getActiveTraceparent() || createTraceparent();

  const dispatch = buildProbeDispatch({
    videoId: video.id,
    sourceKey: video.sourceKey,
    generation: 1,
    traceparent,
    priority: await probePriority(ctx, video.ownerId),
  });

  const transitioned = await ctx.videos.transition({
    videoId: video.id,
    from: 'UPLOADING',
    to: 'UPLOADED',
    eventType: 'upload.completed',
    eventPayload: { uploadId, sizeBytes: actualSizeBytes },
    traceId: activeCtx.traceId || traceparent.split('-')[1],
    outbox: dispatch.outbox,
  });
  if (isErr(transitioned)) return transitioned;
  if (!transitioned.value) return ok({ videoId: video.id, status: 'UPLOADED' });

  if (options?.testCrashAfterCommit) return err(CRASHED_AFTER_COMMIT);

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

  const enqueued = await enqueueProbe(ctx.probeQueue, dispatch);
  if (isErr(enqueued)) return enqueued;

  return ok({ videoId: video.id, status: 'UPLOADED', admission: 'admitted' });
}

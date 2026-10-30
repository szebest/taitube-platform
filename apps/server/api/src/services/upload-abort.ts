import { decideUploadOpen, type UploadOpenFailure, uploadNotOpen } from '@vp/domain-rules';
import type { DatabaseUnavailable, StorageUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { err, isErr, map, type Result } from '@vp/result';
import { type LoadOwnedUploadFailure, loadOwnedUpload, type UploadContext } from './upload-context';

export type AbortUploadFailure =
  | LoadOwnedUploadFailure
  | UploadOpenFailure
  | StorageUnavailable
  | DatabaseUnavailable;

/**
 * Aborts an in-flight upload, cancels the multipart session or removes the
 * single object, and abandons the video it was started for.
 */
export async function abortUpload(
  ctx: UploadContext,
  user: UserContext,
  uploadId: string
): Promise<Result<void, AbortUploadFailure>> {
  const owned = await loadOwnedUpload(ctx, user, uploadId, 'abort this upload');
  if (isErr(owned)) return owned;

  const { upload, video } = owned.value;
  const open = decideUploadOpen({ upload, now: new Date() });
  if (isErr(open)) return open;

  if (upload.strategy === 'multipart' && upload.multipartUploadId) {
    const aborted = await ctx.multipart.abortMultipartUpload(
      ctx.rawBucket,
      video.sourceKey,
      upload.multipartUploadId
    );
    if (isErr(aborted)) return aborted;

    const assembled = await ctx.storage.headObject(ctx.rawBucket, video.sourceKey);
    if (isErr(assembled)) return assembled;
    if (assembled.value) return err(uploadNotOpen(upload.id, 'ASSEMBLED'));
  } else {
    const removed = await ctx.storage.deleteObject(ctx.rawBucket, video.sourceKey);
    if (isErr(removed)) return removed;
  }

  const aborted = await ctx.uploads.updateStatus(uploadId, 'ABORTED');
  if (isErr(aborted)) return aborted;

  if (video.status !== 'UPLOADING') return map(aborted, () => undefined);

  return map(
    await ctx.videos.transition({
      videoId: video.id,
      from: 'UPLOADING',
      to: 'ABANDONED',
      eventType: 'upload.aborted',
      eventPayload: { uploadId, strategy: upload.strategy },
    }),
    () => undefined
  );
}

import { type UploadNotOpen, uploadNotOpen } from '@vp/domain-rules';
import type { DatabaseUnavailable, StorageUnavailable } from '@vp/errors';
import { type Result, err, isErr, map } from '@vp/result';
import type { AuthUser } from '../plugins/auth';
import { type LoadOwnedUploadFailure, type UploadContext, loadOwnedUpload } from './upload-context';

export type AbortUploadFailure =
  | LoadOwnedUploadFailure
  | UploadNotOpen
  | StorageUnavailable
  | DatabaseUnavailable;

/**
 * Aborts an in-flight upload, cancels the multipart session or removes the
 * single object, and abandons the video it was started for.
 */
export async function abortUpload(
  ctx: UploadContext,
  user: AuthUser,
  uploadId: string
): Promise<Result<void, AbortUploadFailure>> {
  const owned = await loadOwnedUpload(ctx, user, uploadId, 'abort this upload');
  if (isErr(owned)) return owned;

  const { upload, video } = owned.value;
  if (upload.status === 'COMPLETED') return err(uploadNotOpen(upload.id, upload.status));

  const removed =
    upload.strategy === 'multipart' && upload.multipartUploadId
      ? await ctx.multipart.abortMultipartUpload(
          ctx.rawBucket,
          video.sourceKey,
          upload.multipartUploadId
        )
      : await ctx.storage.deleteObject(ctx.rawBucket, video.sourceKey);
  if (isErr(removed)) return removed;

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

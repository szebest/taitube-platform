import { ErrorCodes, PermanentError } from '@vp/errors';
import type { AuthUser } from '../plugins/auth';
import { type UploadContext, loadOwnedUpload } from './upload-context';

/**
 * Aborts an in-flight upload, cancels the multipart session or removes the
 * single object, and abandons the video it was started for.
 */
export async function abortUpload(
  ctx: UploadContext,
  user: AuthUser,
  uploadId: string
): Promise<void> {
  const { upload, video } = await loadOwnedUpload(ctx, user, uploadId, 'abort this upload');

  if (upload.status === 'COMPLETED') {
    throw new PermanentError(
      ErrorCodes.UPLOAD_NOT_OPEN,
      'Cannot abort an already completed upload'
    );
  }

  if (upload.strategy === 'multipart' && upload.multipartUploadId) {
    await ctx.multipart.abortMultipartUpload(
      ctx.rawBucket,
      video.sourceKey,
      upload.multipartUploadId
    );
  } else {
    await ctx.storage.deleteObject(ctx.rawBucket, video.sourceKey);
  }

  await ctx.uploads.updateStatus(uploadId, 'ABORTED');

  if (video.status === 'UPLOADING') {
    await ctx.videos.transition({
      videoId: video.id,
      from: 'UPLOADING',
      to: 'ABANDONED',
      eventType: 'upload.aborted',
      eventPayload: { uploadId, strategy: upload.strategy },
    });
  }
}

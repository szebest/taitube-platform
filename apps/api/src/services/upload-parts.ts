import type { StoragePresignedPartInfo, StorageUploadedPartInfo } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { AuthUser } from '../plugins/auth';
import { type UploadContext, assertUploadOpen, loadOwnedUpload } from './upload-context';

export interface UploadResumeInfo {
  status: string;
  strategy: string;
  partSizeBytes?: number | null;
  partsExpected?: number | null;
  uploadedParts?: StorageUploadedPartInfo[];
}

/**
 * Resume state for an in-flight upload, with the uploaded parts read back from
 * storage rather than from our own record — storage is the authority on what
 * actually landed.
 */
export async function getUploadResumeInfo(
  ctx: UploadContext,
  user: AuthUser,
  uploadId: string
): Promise<UploadResumeInfo> {
  const { upload, video } = await loadOwnedUpload(ctx, user, uploadId, 'view this upload');
  assertUploadOpen(upload);

  if (upload.strategy !== 'multipart' || !upload.multipartUploadId) {
    return { status: upload.status, strategy: upload.strategy };
  }

  return {
    status: upload.status,
    strategy: 'multipart',
    partSizeBytes: upload.partSizeBytes,
    partsExpected: upload.partsExpected,
    uploadedParts: await ctx.multipart.listMultipartParts(
      ctx.rawBucket,
      video.sourceKey,
      upload.multipartUploadId
    ),
  };
}

export async function issueUploadPartUrls(
  ctx: UploadContext,
  user: AuthUser,
  uploadId: string,
  from: number,
  count: number
): Promise<StoragePresignedPartInfo[]> {
  const { upload, video } = await loadOwnedUpload(
    ctx,
    user,
    uploadId,
    'request parts for this upload'
  );
  assertUploadOpen(upload);

  if (upload.strategy !== 'multipart' || !upload.multipartUploadId) {
    throw new PermanentError(
      ErrorCodes.VALIDATION_FAILED,
      'Cannot request part URLs for a single PUT upload'
    );
  }

  const endPart = Math.min(from + count - 1, upload.partsExpected || 1);
  const parts: StoragePresignedPartInfo[] = [];

  for (let part = from; part <= endPart; part++) {
    parts.push(
      await ctx.multipart.createPresignedPartUrl({
        bucket: ctx.rawBucket,
        key: video.sourceKey,
        uploadId: upload.multipartUploadId,
        partNumber: part,
        expiresInSeconds: ctx.presignedUrlTtlSeconds,
      })
    );
  }

  return parts;
}

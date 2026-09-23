import type { StoragePresignedPartInfo, StorageUploadedPartInfo } from '@vp/core/ports';
import {
  type NotMultipart,
  type UploadNotOpen,
  notMultipart,
  uploadNotOpen,
} from '@vp/domain-rules';
import type { StorageUnavailable } from '@vp/errors';
import { type Result, all, err, isErr, map, ok } from '@vp/result';
import type { AuthUser } from '../plugins/auth';
import { type LoadOwnedUploadFailure, type UploadContext, loadOwnedUpload } from './upload-context';

export interface UploadResumeInfo {
  status: string;
  strategy: string;
  partSizeBytes?: number | null;
  partsExpected?: number | null;
  uploadedParts?: StorageUploadedPartInfo[];
}

export type ResumeInfoFailure = LoadOwnedUploadFailure | UploadNotOpen | StorageUnavailable;
export type PartUrlsFailure =
  | LoadOwnedUploadFailure
  | UploadNotOpen
  | NotMultipart
  | StorageUnavailable;

/**
 * Resume state for an in-flight upload, with the uploaded parts read back from
 * storage rather than from our own record — storage is the authority on what
 * actually landed.
 */
export async function getUploadResumeInfo(
  ctx: UploadContext,
  user: AuthUser,
  uploadId: string
): Promise<Result<UploadResumeInfo, ResumeInfoFailure>> {
  const owned = await loadOwnedUpload(ctx, user, uploadId, 'view this upload');
  if (isErr(owned)) return owned;

  const { upload, video } = owned.value;
  if (upload.status !== 'OPEN') return err(uploadNotOpen(upload.id, upload.status));

  if (upload.strategy !== 'multipart' || !upload.multipartUploadId) {
    return ok({ status: upload.status, strategy: upload.strategy });
  }

  return map(
    await ctx.multipart.listMultipartParts(
      ctx.rawBucket,
      video.sourceKey,
      upload.multipartUploadId
    ),
    (uploadedParts) => ({
      status: upload.status,
      strategy: 'multipart',
      partSizeBytes: upload.partSizeBytes,
      partsExpected: upload.partsExpected,
      uploadedParts,
    })
  );
}

export async function issueUploadPartUrls(
  ctx: UploadContext,
  user: AuthUser,
  uploadId: string,
  from: number,
  count: number
): Promise<Result<StoragePresignedPartInfo[], PartUrlsFailure>> {
  const owned = await loadOwnedUpload(ctx, user, uploadId, 'request parts for this upload');
  if (isErr(owned)) return owned;

  const { upload, video } = owned.value;
  if (upload.status !== 'OPEN') return err(uploadNotOpen(upload.id, upload.status));

  if (upload.strategy !== 'multipart' || !upload.multipartUploadId) {
    return err(notMultipart(upload.id));
  }

  const endPart = Math.min(from + count - 1, upload.partsExpected || 1);
  const signed: Result<StoragePresignedPartInfo, StorageUnavailable>[] = [];

  for (let part = from; part <= endPart; part++) {
    signed.push(
      await ctx.multipart.createPresignedPartUrl({
        bucket: ctx.rawBucket,
        key: video.sourceKey,
        uploadId: upload.multipartUploadId,
        partNumber: part,
        expiresInSeconds: ctx.presignedUrlTtlSeconds,
      })
    );
  }

  return all(signed);
}

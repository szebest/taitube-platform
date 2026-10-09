import type { StoragePresignedPartInfo, StorageUploadedPartInfo } from '@vp/core/ports';
import {
  type NotMultipart,
  type UploadOpenFailure,
  decideUploadOpen,
  notMultipart,
} from '@vp/domain-rules';
import type { StorageUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, all, err, isErr, map, ok } from '@vp/result';
import { type LoadOwnedUploadFailure, type UploadContext, loadOwnedUpload } from './upload-context';

export interface UploadResumeInfo {
  status: string;
  strategy: string;
  partSizeBytes?: number | null;
  partsExpected?: number | null;
  uploadedParts?: StorageUploadedPartInfo[];
}

export type ResumeInfoFailure = LoadOwnedUploadFailure | UploadOpenFailure | StorageUnavailable;
export type PartUrlsFailure =
  | LoadOwnedUploadFailure
  | UploadOpenFailure
  | NotMultipart
  | StorageUnavailable;

/**
 * Resume state for an in-flight upload, with the uploaded parts read back from
 * storage rather than from our own record — storage is the authority on what
 * actually landed.
 */
export async function getUploadResumeInfo(
  ctx: UploadContext,
  user: UserContext,
  uploadId: string
): Promise<Result<UploadResumeInfo, ResumeInfoFailure>> {
  const owned = await loadOwnedUpload(ctx, user, uploadId, 'view this upload');
  if (isErr(owned)) return owned;

  const { upload, video } = owned.value;
  const open = decideUploadOpen({ upload, now: new Date() });
  if (isErr(open)) return open;

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
  user: UserContext,
  uploadId: string,
  from: number,
  count: number
): Promise<Result<StoragePresignedPartInfo[], PartUrlsFailure>> {
  const owned = await loadOwnedUpload(ctx, user, uploadId, 'request parts for this upload');
  if (isErr(owned)) return owned;

  const { upload, video } = owned.value;
  const open = decideUploadOpen({ upload, now: new Date() });
  if (isErr(open)) return open;

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

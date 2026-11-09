import * as path from 'node:path';
import type { StoragePresignedPartInfo } from '@vp/core/ports';
import type { ActingChannel, VideoVisibility } from '@vp/domain';
import { type AuthorizationFailure, decideChannelTask } from '@vp/domain-rules';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { DatabaseUnavailable, StorageUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, all, isErr, ok } from '@vp/result';
import {
  MULTIPART_URL_BATCH_SIZE,
  calculatePartSize,
  calculateTotalParts,
  rawSourceKey,
} from '@vp/storage';
import { uuidv7 } from 'uuidv7';
import type { UploadContext } from './upload-context';

export interface InitiateUploadParams {
  filename: string;
  sizeBytes: number;
  contentType: string;
  strategy?: 'single' | 'multipart';
  sha256?: string;
  title?: string;
  visibility?: VideoVisibility;
}

export interface InitiateUploadResult {
  videoId: string;
  uploadId: string;
  strategy: 'single' | 'multipart';
  singleUrl?: string;
  headers?: Record<string, string>;
  partSizeBytes?: number;
  partsExpected?: number;
  parts?: StoragePresignedPartInfo[];
  expiresAt: string;
}

export type InitiateUploadFailure = AuthorizationFailure | StorageUnavailable | DatabaseUnavailable;

/** A member's upload is the channel owner's video; the member stays on record as its uploader. */
export async function initiateUpload(
  ctx: UploadContext,
  user: UserContext,
  acting: ActingChannel,
  params: InitiateUploadParams
): Promise<Result<InitiateUploadResult, InitiateUploadFailure>> {
  const allowed = decideChannelTask({ user, acting, task: 'upload' });
  if (isErr(allowed)) return allowed;

  const { filename, sizeBytes, contentType, sha256, title, visibility } = params;

  const videoId = uuidv7();
  const uploadId = uuidv7();
  const ext = path.extname(filename).slice(1) || 'mp4';
  const sourceKey = rawSourceKey(videoId, ext);
  const expiresAt = new Date(Date.now() + ctx.presignedUrlTtlSeconds * MS_PER_SECOND);
  const sessionExpiresAt = new Date(Date.now() + ctx.uploadSessionTtlSeconds * MS_PER_SECOND);

  const isMultipart = params.strategy
    ? params.strategy === 'multipart'
    : sizeBytes > ctx.multipartThresholdBytes;

  const createVideoRow = () =>
    ctx.videos.create({
      id: videoId,
      ownerId: allowed.value.ownerId,
      title: title || filename,
      visibility: visibility || 'private',
      status: 'UPLOADING',
      sourceKey,
      sourceSizeBytes: sizeBytes,
    });

  if (!isMultipart) {
    const presigned = await ctx.storage.createPresignedPutUrl({
      bucket: ctx.rawBucket,
      key: sourceKey,
      contentType,
      contentLength: sizeBytes,
      expiresInSeconds: ctx.presignedUrlTtlSeconds,
    });
    if (isErr(presigned)) return presigned;

    const created = await createVideoRow();
    if (isErr(created)) return created;

    const opened = await ctx.uploads.create({
      id: uploadId,
      videoId,
      strategy: 'single',
      status: 'OPEN',
      partSizeBytes: sizeBytes,
      partsExpected: 1,
      declaredSizeBytes: sizeBytes,
      declaredContentType: contentType,
      sha256,
      expiresAt: sessionExpiresAt,
    });
    if (isErr(opened)) return opened;

    const recorded = await ctx.events.create({
      videoId,
      type: 'upload.initiated',
      payload: { uploadId, strategy: 'single', sizeBytes, filename, uploadedBy: user.id },
    });
    if (isErr(recorded)) return recorded;

    return ok({
      videoId,
      uploadId,
      strategy: 'single',
      singleUrl: presigned.value.url,
      headers: presigned.value.headers,
      expiresAt: expiresAt.toISOString(),
    });
  }

  const partSizeBytes = calculatePartSize(sizeBytes, {
    minBytes: ctx.partSizeMinBytes,
    maxBytes: ctx.partSizeMaxBytes,
  });
  const partsExpected = calculateTotalParts(sizeBytes, partSizeBytes);

  const session = await ctx.multipart.createMultipartUpload(ctx.rawBucket, sourceKey, contentType);
  if (isErr(session)) return session;
  const multipartUploadId = session.value;

  const created = await createVideoRow();
  if (isErr(created)) return created;

  const opened = await ctx.uploads.create({
    id: uploadId,
    videoId,
    strategy: 'multipart',
    status: 'OPEN',
    multipartUploadId,
    partSizeBytes,
    partsExpected,
    declaredSizeBytes: sizeBytes,
    declaredContentType: contentType,
    sha256,
    expiresAt: sessionExpiresAt,
  });
  if (isErr(opened)) return opened;

  const recorded = await ctx.events.create({
    videoId,
    type: 'upload.initiated',
    payload: {
      uploadId,
      strategy: 'multipart',
      sizeBytes,
      filename,
      partSizeBytes,
      partsExpected,
      multipartUploadId,
      uploadedBy: user.id,
    },
  });
  if (isErr(recorded)) return recorded;

  const signed: Result<StoragePresignedPartInfo, StorageUnavailable>[] = [];
  for (let part = 1; part <= Math.min(partsExpected, MULTIPART_URL_BATCH_SIZE); part++) {
    signed.push(
      await ctx.multipart.createPresignedPartUrl({
        bucket: ctx.rawBucket,
        key: sourceKey,
        uploadId: multipartUploadId,
        partNumber: part,
        expiresInSeconds: ctx.presignedUrlTtlSeconds,
      })
    );
  }

  const parts = all(signed);
  if (isErr(parts)) return parts;

  return ok({
    videoId,
    uploadId,
    strategy: 'multipart',
    partSizeBytes,
    partsExpected,
    parts: parts.value,
    expiresAt: expiresAt.toISOString(),
  });
}

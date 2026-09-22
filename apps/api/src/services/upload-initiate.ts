import * as path from 'node:path';
import type { StoragePresignedPartInfo } from '@vp/core/ports';
import type { VideoVisibility } from '@vp/domain';
import { calculatePartSize, calculateTotalParts, rawSourceKey } from '@vp/storage';
import { uuidv7 } from 'uuidv7';
import type { AuthUser } from '../plugins/auth';
import type { UploadContext } from './upload-context';

const INITIAL_PART_URL_BATCH = 100;

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

export async function initiateUpload(
  ctx: UploadContext,
  user: AuthUser,
  params: InitiateUploadParams
): Promise<InitiateUploadResult> {
  const { filename, sizeBytes, contentType, sha256, title, visibility } = params;

  const videoId = uuidv7();
  const uploadId = uuidv7();
  const ext = path.extname(filename).slice(1) || 'mp4';
  const sourceKey = rawSourceKey(videoId, ext);
  const expiresAt = new Date(Date.now() + ctx.presignedUrlTtlSeconds * 1000);

  const isMultipart = params.strategy
    ? params.strategy === 'multipart'
    : sizeBytes > ctx.multipartThresholdBytes;

  const createVideoRow = () =>
    ctx.videos.create({
      id: videoId,
      ownerId: user.id,
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

    await createVideoRow();

    await ctx.uploads.create({
      id: uploadId,
      videoId,
      strategy: 'single',
      status: 'OPEN',
      partSizeBytes: sizeBytes,
      partsExpected: 1,
      declaredSizeBytes: sizeBytes,
      declaredContentType: contentType,
      sha256,
      expiresAt,
    });

    await ctx.events.create({
      videoId,
      type: 'upload.initiated',
      payload: { uploadId, strategy: 'single', sizeBytes, filename },
    });

    return {
      videoId,
      uploadId,
      strategy: 'single',
      singleUrl: presigned.url,
      headers: presigned.headers,
      expiresAt: expiresAt.toISOString(),
    };
  }

  const partSizeBytes = calculatePartSize(sizeBytes);
  const partsExpected = calculateTotalParts(sizeBytes, partSizeBytes);

  const multipartUploadId = await ctx.multipart.createMultipartUpload(
    ctx.rawBucket,
    sourceKey,
    contentType
  );

  await createVideoRow();

  await ctx.uploads.create({
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
    expiresAt,
  });

  await ctx.events.create({
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
    },
  });

  const parts: StoragePresignedPartInfo[] = [];
  for (let part = 1; part <= Math.min(partsExpected, INITIAL_PART_URL_BATCH); part++) {
    parts.push(
      await ctx.multipart.createPresignedPartUrl({
        bucket: ctx.rawBucket,
        key: sourceKey,
        uploadId: multipartUploadId,
        partNumber: part,
        expiresInSeconds: ctx.presignedUrlTtlSeconds,
      })
    );
  }

  return {
    videoId,
    uploadId,
    strategy: 'multipart',
    partSizeBytes,
    partsExpected,
    parts,
    expiresAt: expiresAt.toISOString(),
  };
}

import * as fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
  S3Client,
  type S3ClientConfig,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export { S3Client };

export interface StorageConfig {
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

export function createStorageClient(config: StorageConfig = {}): S3Client {
  const endpoint = config.endpoint ?? process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000';
  const region = config.region ?? process.env.STORAGE_REGION ?? 'us-east-1';
  const accessKeyId = config.accessKeyId ?? process.env.STORAGE_ACCESS_KEY_ID ?? 'minioadmin';
  const secretAccessKey =
    config.secretAccessKey ?? process.env.STORAGE_SECRET_ACCESS_KEY ?? 'minioadmin';
  const forcePathStyle =
    config.forcePathStyle ??
    (process.env.STORAGE_FORCE_PATH_STYLE === 'true' ||
      endpoint.includes('localhost') ||
      endpoint.includes('127.0.0.1'));

  const s3Config: S3ClientConfig = {
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle,
  };

  return new S3Client(s3Config);
}

export interface PresignedPutOptions {
  bucket: string;
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}

export interface PresignedPutResult {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

/**
 * Creates a presigned PUT URL for single upload (SDD §3.1, §6.1, AC 17).
 * Signs Content-Type and Content-Length to ensure file size integrity directly at storage level.
 */
export async function createPresignedPutUrl(
  client: S3Client,
  options: PresignedPutOptions
): Promise<PresignedPutResult> {
  const {
    bucket,
    key,
    contentType,
    contentLength,
    expiresInSeconds = 15 * 60, // 15 minutes max per SDD §3.1
  } = options;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const url = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
    signableHeaders: new Set(['content-type', 'content-length']),
  });

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  return {
    url,
    headers: {
      'content-type': contentType,
      'content-length': String(contentLength),
    },
    expiresAt,
  };
}

export interface HeadObjectInfo {
  contentLength: number;
  contentType?: string;
  etag?: string;
}

/**
 * Heads an object in storage. Returns null if object does not exist.
 */
export async function headObject(
  client: S3Client,
  bucket: string,
  key: string
): Promise<HeadObjectInfo | null> {
  try {
    const res = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    return {
      contentLength: res.ContentLength ?? 0,
      contentType: res.ContentType,
      etag: res.ETag,
    };
  } catch (err: unknown) {
    const errorName = (err as { name?: string }).name;
    const statusCode = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;

    if (errorName === 'NotFound' || errorName === 'NoSuchKey' || statusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Deletes an object from storage.
 */
export async function deleteObject(client: S3Client, bucket: string, key: string): Promise<void> {
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * Downloads an object from storage directly to a local file.
 * Returns false if the object does not exist.
 */
export async function downloadObject(
  client: S3Client,
  bucket: string,
  key: string,
  targetFilePath: string
): Promise<boolean> {
  try {
    const res = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (!res.Body) {
      return false;
    }

    const writeStream = fs.createWriteStream(targetFilePath);
    await pipeline(res.Body as NodeJS.ReadableStream, writeStream);
    return true;
  } catch (err: unknown) {
    const errorName = (err as { name?: string }).name;
    const statusCode = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode;

    if (errorName === 'NotFound' || errorName === 'NoSuchKey' || statusCode === 404) {
      return false;
    }
    throw err;
  }
}

/**
 * Sanitizes presigned URLs for safe logging (SDD §11, Notes for implementer).
 */
export function sanitizeStorageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    return parsed.toString();
  } catch {
    return url.split('?')[0] || url;
  }
}

export interface UploadObjectOptions {
  bucket: string;
  key: string;
  body: PutObjectCommandInput['Body'];
  contentType: string;
  cacheControl?: string;
}

/**
 * Uploads an object with authoritative metadata (SDD §7).
 */
export async function uploadObject(client: S3Client, options: UploadObjectOptions): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
      CacheControl: options.cacheControl,
    })
  );
}

export const MULTIPART_MIN_PART_SIZE = 8 * 1024 * 1024; // 8 MiB (AC 17)
export const MULTIPART_MAX_PART_SIZE = 64 * 1024 * 1024; // 64 MiB (AC 17)
export const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100 MB (SDD §3.1)
export const MULTIPART_MAX_PARTS = 10000; // <= 10 000 parts (AC 17)
export const MULTIPART_URL_BATCH_SIZE = 100; // batches of <= 100 URLs (AC 17)
export const PRESIGNED_URL_TTL_SEC = 900; // 15 min (AC 17)

/**
 * Computes part size using clamp(ceil(size/1000), 8 MiB, 64 MiB) (SDD §3.1, AC 17).
 */
export function calculatePartSize(sizeBytes: number): number {
  const calculated = Math.ceil(sizeBytes / 1000);
  return Math.min(Math.max(calculated, MULTIPART_MIN_PART_SIZE), MULTIPART_MAX_PART_SIZE);
}

/**
 * Calculates total expected parts for a given file size and part size.
 */
export function calculateTotalParts(sizeBytes: number, partSize: number): number {
  return Math.ceil(sizeBytes / partSize);
}

/**
 * Initiates a multipart upload in S3 storage (SDD §3.1, §6.1, AC 17).
 */
export async function createMultipartUpload(
  client: S3Client,
  bucket: string,
  key: string,
  contentType: string
): Promise<string> {
  const res = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })
  );
  if (!res.UploadId) {
    throw new Error(`Failed to initiate multipart upload for ${key}`);
  }
  return res.UploadId;
}

export interface PresignedPartOptions {
  bucket: string;
  key: string;
  uploadId: string;
  partNumber: number;
  expiresInSeconds?: number;
}

export interface PresignedPartInfo {
  partNumber: number;
  url: string;
  expiresAt: string;
}

/**
 * Generates a presigned URL for uploading an individual part (SDD §3.1, AC 17).
 */
export async function createPresignedPartUrl(
  client: S3Client,
  options: PresignedPartOptions
): Promise<PresignedPartInfo> {
  const { bucket, key, uploadId, partNumber, expiresInSeconds = PRESIGNED_URL_TTL_SEC } = options;
  const command = new UploadPartCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  const url = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  return {
    partNumber,
    url,
    expiresAt,
  };
}

export interface UploadedPartInfo {
  partNumber: number;
  etag: string;
  size: number;
}

/**
 * Lists parts already uploaded to S3 storage for resumability (SDD §3.1, §6.1, AC 18).
 */
export async function listMultipartParts(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string
): Promise<UploadedPartInfo[]> {
  const parts: UploadedPartInfo[] = [];
  let partNumberMarker: string | undefined;

  do {
    const res = await client.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumberMarker: partNumberMarker,
      })
    );

    if (res.Parts) {
      for (const p of res.Parts) {
        if (p.PartNumber && p.ETag) {
          parts.push({
            partNumber: p.PartNumber,
            etag: p.ETag.replace(/^"|"$/g, ''),
            size: p.Size ?? 0,
          });
        }
      }
    }

    if (res.IsTruncated && res.NextPartNumberMarker) {
      partNumberMarker = String(res.NextPartNumberMarker);
    } else {
      break;
    }
  } while (partNumberMarker);

  return parts;
}

export interface CompletePartInput {
  partNumber: number;
  etag: string;
}

/**
 * Completes a multipart upload in S3 storage (SDD §3.1, AC 18, AC 19).
 */
export async function completeMultipartUpload(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
  parts: CompletePartInput[]
): Promise<void> {
  const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);

  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts.map((p) => ({
          PartNumber: p.partNumber,
          ETag: p.etag.startsWith('"') ? p.etag : `"${p.etag}"`,
        })),
      },
    })
  );
}

/**
 * Aborts a multipart upload and cleans up stored parts in S3 (SDD §3.1, §6.1, AC 20).
 */
export async function abortMultipartUpload(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string
): Promise<void> {
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    })
  );
}

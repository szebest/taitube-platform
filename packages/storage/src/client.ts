import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
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

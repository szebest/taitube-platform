import * as fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  StorageClient,
  type StorageDeleteObjectsResult,
  StorageError,
  type StorageListObjectsParams,
  type StorageListObjectsResult,
  type StorageObjectMetadata,
  type StoragePresignedGetParams,
  type StoragePresignedPutParams,
  type StoragePresignedPutResult,
  type StorageUploadParams,
  type StorageUploadResult,
} from '@vp/core/ports';
import { measureStorageOp } from '../storage-metrics-helper';

export interface S3StorageClientConfig {
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  client?: S3Client;
}

export class S3StorageClient extends StorageClient {
  private readonly client: S3Client;

  constructor(config: S3StorageClientConfig = {}) {
    super();
    if (config.client) {
      this.client = config.client;
      return;
    }

    const endpoint =
      config.endpoint ??
      process.env['S3_ENDPOINT'] ??
      process.env['STORAGE_ENDPOINT'] ??
      'http://localhost:9000';
    const region =
      config.region ?? process.env['S3_REGION'] ?? process.env['STORAGE_REGION'] ?? 'us-east-1';
    const accessKeyId =
      config.accessKeyId ??
      process.env['S3_ACCESS_KEY_ID'] ??
      process.env['STORAGE_ACCESS_KEY_ID'] ??
      'minioadmin';
    const secretAccessKey =
      config.secretAccessKey ??
      process.env['S3_SECRET_ACCESS_KEY'] ??
      process.env['STORAGE_SECRET_ACCESS_KEY'] ??
      'minioadmin';
    const forcePathStyle =
      config.forcePathStyle ??
      (process.env['S3_FORCE_PATH_STYLE'] === 'true' ||
        process.env['STORAGE_FORCE_PATH_STYLE'] === 'true' ||
        endpoint.includes('localhost') ||
        endpoint.includes('127.0.0.1') ||
        endpoint.includes('minio'));

    const s3Config: S3ClientConfig = {
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
    };

    this.client = new S3Client(s3Config);
  }

  getRawClient(): S3Client {
    return this.client;
  }

  async checkHealth(): Promise<boolean> {
    try {
      return true;
    } catch {
      return false;
    }
  }

  async uploadObject(params: StorageUploadParams): Promise<StorageUploadResult> {
    return measureStorageOp('put', params.bucket, async () => {
      try {
        const command = new PutObjectCommand({
          Bucket: params.bucket,
          Key: params.key,
          Body: params.body as PutObjectCommand['input']['Body'],
          ContentType: params.contentType,
          CacheControl: params.cacheControl,
        });
        const res = await this.client.send(command);
        return {
          key: params.key,
          etag: res.ETag,
        };
      } catch (err: unknown) {
        throw new StorageError(`Failed to upload object ${params.key}: ${(err as Error).message}`, {
          cause: err,
        });
      }
    });
  }

  async headObject(bucket: string, key: string): Promise<StorageObjectMetadata | null> {
    return measureStorageOp('head', bucket, async () => {
      try {
        const command = new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        });
        const res = await this.client.send(command);
        return {
          contentLength: res.ContentLength ?? 0,
          contentType: res.ContentType,
          cacheControl: res.CacheControl,
          etag: res.ETag,
        };
      } catch (err: unknown) {
        const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        // AWS SDK v3 generates a service-exception class per command, so `instanceof` is unreliable
        // across sub-package versions; `name` is what the SDK documents for discriminating them.
        if (
          error.name === 'NotFound' ||
          error.name === 'NoSuchKey' ||
          error.$metadata?.httpStatusCode === 404
        ) {
          return null;
        }
        throw new StorageError(`Failed to head object ${key}: ${(err as Error).message}`, {
          cause: err,
        });
      }
    });
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    return measureStorageOp('get', bucket, async () => {
      try {
        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        });
        const res = await this.client.send(command);
        if (!res.Body) {
          throw new Error('Empty response body received from S3');
        }
        const stream = res.Body as AsyncIterable<Uint8Array | Buffer | string>;
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      } catch (err: unknown) {
        throw new StorageError(`Failed to get object ${key}: ${(err as Error).message}`, {
          cause: err,
        });
      }
    });
  }

  async downloadObject(bucket: string, key: string, targetFilePath: string): Promise<boolean> {
    return measureStorageOp('get', bucket, async () => {
      try {
        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        });
        const res = await this.client.send(command);
        if (!res.Body) {
          return false;
        }
        const readStream = res.Body as NodeJS.ReadableStream;
        const writeStream = fs.createWriteStream(targetFilePath);
        await pipeline(readStream, writeStream);
        return true;
      } catch (err: unknown) {
        const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        // AWS SDK v3 generates a service-exception class per command, so `instanceof` is unreliable
        // across sub-package versions; `name` is what the SDK documents for discriminating them.
        if (
          error.name === 'NotFound' ||
          error.name === 'NoSuchKey' ||
          error.$metadata?.httpStatusCode === 404
        ) {
          return false;
        }
        throw new StorageError(`Failed to download object ${key}: ${(err as Error).message}`, {
          cause: err,
        });
      }
    });
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    return measureStorageOp('delete', bucket, async () => {
      try {
        const command = new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        });
        await this.client.send(command);
      } catch (err: unknown) {
        throw new StorageError(`Failed to delete object ${key}: ${(err as Error).message}`, {
          cause: err,
        });
      }
    });
  }

  async deleteObjects(bucket: string, keys: string[]): Promise<StorageDeleteObjectsResult> {
    if (keys.length === 0) {
      return { deletedKeys: [] };
    }
    return measureStorageOp('delete', bucket, async () => {
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < keys.length; i += 1000) {
          chunks.push(keys.slice(i, i + 1000));
        }
        const deleted: string[] = [];
        for (const chunk of chunks) {
          const command = new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: chunk.map((Key) => ({ Key })),
              Quiet: true,
            },
          });
          await this.client.send(command);
          deleted.push(...chunk);
        }
        return { deletedKeys: deleted };
      } catch (err: unknown) {
        throw new StorageError(`Failed to delete objects: ${(err as Error).message}`, {
          cause: err,
        });
      }
    });
  }

  async listObjects(params: StorageListObjectsParams): Promise<StorageListObjectsResult> {
    return measureStorageOp('list', params.bucket, async () => {
      try {
        const command = new ListObjectsV2Command({
          Bucket: params.bucket,
          Prefix: params.prefix,
          ContinuationToken: params.continuationToken,
          MaxKeys: params.maxKeys,
        });
        const res = await this.client.send(command);
        const keys = (res.Contents ?? [])
          .map((obj) => obj.Key)
          .filter((k): k is string => typeof k === 'string' && k.length > 0);
        return {
          keys,
          nextContinuationToken: res.NextContinuationToken,
          isTruncated: res.IsTruncated ?? false,
        };
      } catch (err: unknown) {
        throw new StorageError(
          `Failed to list objects in bucket ${params.bucket}: ${(err as Error).message}`,
          { cause: err }
        );
      }
    });
  }

  async purgePrefix(bucket: string, prefix: string): Promise<number> {
    let totalDeleted = 0;
    let continuationToken: string | undefined;
    do {
      const page = await this.listObjects({
        bucket,
        prefix,
        continuationToken,
        maxKeys: 1000,
      });
      if (page.keys.length > 0) {
        await this.deleteObjects(bucket, page.keys);
        totalDeleted += page.keys.length;
      }
      continuationToken = page.isTruncated ? page.nextContinuationToken : undefined;
    } while (continuationToken);
    return totalDeleted;
  }

  async createPresignedPutUrl(
    params: StoragePresignedPutParams
  ): Promise<StoragePresignedPutResult> {
    try {
      const expiresIn = params.expiresInSeconds ?? 900;
      const command = new PutObjectCommand({
        Bucket: params.bucket,
        Key: params.key,
        ContentType: params.contentType,
        ContentLength: params.contentLength,
      });

      const url = await getSignedUrl(this.client, command, {
        expiresIn,
      });

      return {
        url,
        headers: {
          'content-type': params.contentType,
          'content-length': String(params.contentLength ?? 0),
        },
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };
    } catch (err: unknown) {
      throw new StorageError(
        `Failed to create presigned PUT url for ${params.key}: ${(err as Error).message}`,
        {
          cause: err,
        }
      );
    }
  }

  async createPresignedGetUrl(params: StoragePresignedGetParams): Promise<string> {
    try {
      const expiresIn = params.expiresInSeconds ?? 900;
      const command = new GetObjectCommand({
        Bucket: params.bucket,
        Key: params.key,
      });

      return await getSignedUrl(this.client, command, {
        expiresIn,
      });
    } catch (err: unknown) {
      throw new StorageError(
        `Failed to create presigned GET url for ${params.key}: ${(err as Error).message}`,
        {
          cause: err,
        }
      );
    }
  }

  async close(): Promise<void> {
    this.client.destroy();
  }
}

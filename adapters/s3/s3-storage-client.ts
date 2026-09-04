import * as fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  StorageClient,
  StorageError,
  type StorageObjectMetadata,
  type StoragePresignedPutParams,
  type StoragePresignedPutResult,
  type StorageUploadParams,
  type StorageUploadResult,
} from '@vp/core/ports';

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

    const endpoint = config.endpoint ?? process.env['STORAGE_ENDPOINT'] ?? 'http://localhost:9000';
    const region = config.region ?? process.env['STORAGE_REGION'] ?? 'us-east-1';
    const accessKeyId = config.accessKeyId ?? process.env['STORAGE_ACCESS_KEY_ID'] ?? 'minioadmin';
    const secretAccessKey =
      config.secretAccessKey ?? process.env['STORAGE_SECRET_ACCESS_KEY'] ?? 'minioadmin';
    const forcePathStyle =
      config.forcePathStyle ??
      (process.env['STORAGE_FORCE_PATH_STYLE'] === 'true' ||
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
  }

  async headObject(bucket: string, key: string): Promise<StorageObjectMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      const res = await this.client.send(command);
      return {
        contentLength: res.ContentLength ?? 0,
        contentType: res.ContentType,
        etag: res.ETag,
      };
    } catch (err: unknown) {
      const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
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
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      const res = await this.client.send(command);
      if (!res.Body) {
        throw new Error('Empty response body received from S3');
      }
      const stream = res.Body as any;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      return Buffer.concat(chunks);
    } catch (err: unknown) {
      throw new StorageError(`Failed to get object ${key}: ${(err as Error).message}`, {
        cause: err,
      });
    }
  }

  async downloadObject(bucket: string, key: string, targetFilePath: string): Promise<boolean> {
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
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
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

  async close(): Promise<void> {
    this.client.destroy();
  }
}

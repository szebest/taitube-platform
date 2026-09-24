import * as fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  StorageClient,
  type StorageDeleteObjectsResult,
  type StorageListObjectsParams,
  type StorageListObjectsResult,
  type StorageObjectMetadata,
  type StoragePresignedGetParams,
  type StoragePresignedPutParams,
  type StoragePresignedPutResult,
  type StorageUploadParams,
  type StorageUploadResult,
} from '@vp/core/ports';
import { MS_PER_SECOND } from '@vp/domain/time';
import { type StorageUnavailable, storageUnavailable } from '@vp/errors';
import { type Result, assertNever, err, fromPromise, map, ok } from '@vp/result';
import { S3_MAX_KEYS_PER_REQUEST } from '@vp/storage';
import { type S3ConnectionConfig, isNotFound, s3ClientFrom } from './s3-config';

export type S3StorageClientConfig =
  | { type: 'client'; client: S3Client }
  | ({ type: 'connection' } & S3ConnectionConfig);

export class S3StorageClient extends StorageClient {
  private readonly client: S3Client;

  constructor(config: S3StorageClientConfig) {
    super();
    this.client = S3StorageClient.clientFor(config);
  }

  private static clientFor(config: S3StorageClientConfig): S3Client {
    switch (config.type) {
      case 'client':
        return config.client;
      case 'connection':
        return s3ClientFrom(config);
      default:
        return assertNever(config, 'S3StorageClientConfig');
    }
  }

  getRawClient(): S3Client {
    return this.client;
  }

  /** A 404 is an answer, not a fault: it resolves to `absent` while any other cause is a failure. */
  private async absentOr<T>(
    operation: string,
    absent: T,
    run: () => Promise<T>
  ): Promise<Result<T, StorageUnavailable>> {
    const sent = await fromPromise(run, (cause) =>
      isNotFound(cause) ? null : storageUnavailable(operation, cause)
    );
    if (sent.ok) return ok(sent.value);
    return sent.error === null ? ok(absent) : err(sent.error);
  }

  async checkHealth(): Promise<Result<void, StorageUnavailable>> {
    return ok();
  }

  async uploadObject(
    params: StorageUploadParams
  ): Promise<Result<StorageUploadResult, StorageUnavailable>> {
    const sent = await fromPromise(
      () =>
        this.client.send(
          new PutObjectCommand({
            Bucket: params.bucket,
            Key: params.key,
            Body: params.body as PutObjectCommand['input']['Body'],
            ContentType: params.contentType,
            CacheControl: params.cacheControl,
          })
        ),
      storageUnavailable.during('uploadObject')
    );

    return map(sent, (res) => ({ key: params.key, etag: res.ETag }));
  }

  async headObject(
    bucket: string,
    key: string
  ): Promise<Result<StorageObjectMetadata | null, StorageUnavailable>> {
    return this.absentOr<StorageObjectMetadata | null>('headObject', null, async () => {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return {
        contentLength: res.ContentLength ?? 0,
        contentType: res.ContentType,
        cacheControl: res.CacheControl,
        etag: res.ETag,
      };
    });
  }

  async getObject(bucket: string, key: string): Promise<Result<Buffer, StorageUnavailable>> {
    return fromPromise(async () => {
      const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!res.Body) throw new Error('Empty response body received from S3');

      const chunks: Buffer[] = [];
      for await (const chunk of res.Body as AsyncIterable<Uint8Array | Buffer | string>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }, storageUnavailable.during('getObject'));
  }

  async downloadObject(
    bucket: string,
    key: string,
    targetFilePath: string
  ): Promise<Result<boolean, StorageUnavailable>> {
    return this.absentOr('downloadObject', false, async () => {
      const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!res.Body) return false;
      await pipeline(res.Body as NodeJS.ReadableStream, fs.createWriteStream(targetFilePath));
      return true;
    });
  }

  async deleteObject(bucket: string, key: string): Promise<Result<void, StorageUnavailable>> {
    const sent = await fromPromise(
      () => this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
      storageUnavailable.during('deleteObject')
    );
    return map(sent, () => undefined);
  }

  async deleteObjects(
    bucket: string,
    keys: string[]
  ): Promise<Result<StorageDeleteObjectsResult, StorageUnavailable>> {
    if (keys.length === 0) return ok({ deletedKeys: [] });

    const deleted: string[] = [];
    for (let i = 0; i < keys.length; i += S3_MAX_KEYS_PER_REQUEST) {
      const chunk = keys.slice(i, i + S3_MAX_KEYS_PER_REQUEST);
      const sent = await fromPromise(
        () =>
          this.client.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
            })
          ),
        storageUnavailable.during('deleteObjects')
      );
      if (!sent.ok) return sent;
      deleted.push(...chunk);
    }
    return ok({ deletedKeys: deleted });
  }

  async listObjects(
    params: StorageListObjectsParams
  ): Promise<Result<StorageListObjectsResult, StorageUnavailable>> {
    const sent = await fromPromise(
      () =>
        this.client.send(
          new ListObjectsV2Command({
            Bucket: params.bucket,
            Prefix: params.prefix,
            ContinuationToken: params.continuationToken,
            MaxKeys: params.maxKeys,
          })
        ),
      storageUnavailable.during('listObjects')
    );

    return map(sent, (res) => ({
      keys: (res.Contents ?? [])
        .map((obj) => obj.Key)
        .filter((k): k is string => typeof k === 'string' && k.length > 0),
      nextContinuationToken: res.NextContinuationToken,
      isTruncated: res.IsTruncated ?? false,
    }));
  }

  async purgePrefix(bucket: string, prefix: string): Promise<Result<number, StorageUnavailable>> {
    let totalDeleted = 0;
    let continuationToken: string | undefined;
    do {
      const listed = await this.listObjects({ bucket, prefix, continuationToken, maxKeys: 1000 });
      if (!listed.ok) return listed;

      const page = listed.value;
      if (page.keys.length > 0) {
        const removed = await this.deleteObjects(bucket, page.keys);
        if (!removed.ok) return removed;
        totalDeleted += page.keys.length;
      }
      continuationToken = page.isTruncated ? page.nextContinuationToken : undefined;
    } while (continuationToken);

    return ok(totalDeleted);
  }

  async createPresignedPutUrl(
    params: StoragePresignedPutParams
  ): Promise<Result<StoragePresignedPutResult, StorageUnavailable>> {
    const expiresIn = params.expiresInSeconds;
    const signed = await fromPromise(
      () =>
        getSignedUrl(
          this.client,
          new PutObjectCommand({
            Bucket: params.bucket,
            Key: params.key,
            ContentType: params.contentType,
            ContentLength: params.contentLength,
          }),
          { expiresIn }
        ),
      storageUnavailable.during('createPresignedPutUrl')
    );

    return map(signed, (url) => ({
      url,
      headers: {
        'content-type': params.contentType,
        'content-length': String(params.contentLength ?? 0),
      },
      expiresAt: new Date(Date.now() + expiresIn * MS_PER_SECOND),
    }));
  }

  async createPresignedGetUrl(
    params: StoragePresignedGetParams
  ): Promise<Result<string, StorageUnavailable>> {
    return fromPromise(
      () =>
        getSignedUrl(
          this.client,
          new GetObjectCommand({ Bucket: params.bucket, Key: params.key }),
          { expiresIn: params.expiresInSeconds }
        ),
      storageUnavailable.during('createPresignedGetUrl')
    );
  }

  async close(): Promise<Result<void, StorageUnavailable>> {
    this.client.destroy();
    return ok();
  }
}

import * as fs from 'node:fs';
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
import { type StorageUnavailable, storageUnavailable } from '@vp/errors';
import { type Result, err, ok } from '@vp/result';
import { S3_MAX_KEYS_PER_REQUEST } from '@vp/storage';
import { measureStorageOp } from '../storage-metrics-helper';

interface StoredObject {
  data: Buffer;
  contentType: string;
  cacheControl?: string;
  etag: string;
}

export class InMemoryStorageClient extends StorageClient {
  private readonly storage = new Map<string, StoredObject>();
  private isHealthy = true;

  setHealthy(healthy: boolean): void {
    this.isHealthy = healthy;
  }

  private getStorageKey(bucket: string, key: string): string {
    return `${bucket}/${key}`;
  }

  async checkHealth(): Promise<Result<void, StorageUnavailable>> {
    return this.isHealthy ? ok() : err(storageUnavailable('checkHealth'));
  }

  async uploadObject(
    params: StorageUploadParams
  ): Promise<Result<StorageUploadResult, StorageUnavailable>> {
    return measureStorageOp('put', params.bucket, async () => {
      let buf: Buffer;
      if (Buffer.isBuffer(params.body)) {
        buf = params.body;
      } else if (typeof params.body === 'string') {
        buf = Buffer.from(params.body);
      } else if (params.body instanceof Uint8Array) {
        buf = Buffer.from(params.body);
      } else {
        // Readable stream
        const chunks: Buffer[] = [];
        for await (const chunk of params.body as AsyncIterable<Uint8Array | Buffer>) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        buf = Buffer.concat(chunks);
      }

      const etag = `etag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.storage.set(this.getStorageKey(params.bucket, params.key), {
        data: buf,
        contentType: params.contentType,
        cacheControl: params.cacheControl,
        etag,
      });

      return ok({
        key: params.key,
        etag,
      });
    });
  }

  async downloadObject(
    bucket: string,
    key: string,
    targetFilePath: string
  ): Promise<Result<boolean, StorageUnavailable>> {
    return measureStorageOp('get', bucket, async () => {
      const item = this.storage.get(this.getStorageKey(bucket, key));
      if (!item) {
        return ok(false);
      }
      fs.writeFileSync(targetFilePath, item.data);
      return ok(true);
    });
  }

  async headObject(
    bucket: string,
    key: string
  ): Promise<Result<StorageObjectMetadata | null, StorageUnavailable>> {
    return measureStorageOp('head', bucket, async () => {
      const item = this.storage.get(this.getStorageKey(bucket, key));
      if (!item) {
        return ok(null);
      }
      return ok({
        contentLength: item.data.length,
        contentType: item.contentType,
        cacheControl: item.cacheControl,
        etag: item.etag,
      });
    });
  }

  async deleteObject(bucket: string, key: string): Promise<Result<void, StorageUnavailable>> {
    return measureStorageOp('delete', bucket, async () => {
      this.storage.delete(this.getStorageKey(bucket, key));
      return ok();
    });
  }

  async deleteObjects(
    bucket: string,
    keys: string[]
  ): Promise<Result<StorageDeleteObjectsResult, StorageUnavailable>> {
    const deleted: string[] = [];
    return measureStorageOp('delete', bucket, async () => {
      for (const key of keys) {
        this.storage.delete(this.getStorageKey(bucket, key));
        deleted.push(key);
      }
      return ok({ deletedKeys: deleted });
    });
  }

  async listObjects(
    params: StorageListObjectsParams
  ): Promise<Result<StorageListObjectsResult, StorageUnavailable>> {
    return measureStorageOp('list', params.bucket, async () => {
      const bucketPrefix = `${params.bucket}/`;
      const fullPrefix = `${params.bucket}/${params.prefix ?? ''}`;
      const matchingKeys: string[] = [];
      for (const k of this.storage.keys()) {
        if (k.startsWith(fullPrefix)) {
          matchingKeys.push(k.slice(bucketPrefix.length));
        }
      }
      matchingKeys.sort();

      const maxKeys = params.maxKeys ?? S3_MAX_KEYS_PER_REQUEST;
      let filteredKeys = matchingKeys;
      if (params.continuationToken) {
        const token = params.continuationToken;
        filteredKeys = matchingKeys.filter((k) => k > token);
      }

      const slice = filteredKeys.slice(0, maxKeys);
      const isTruncated = filteredKeys.length > maxKeys;
      const lastKey = slice.length > 0 ? slice[slice.length - 1] : undefined;
      return ok({
        keys: slice,
        nextContinuationToken: isTruncated ? lastKey : undefined,
        isTruncated,
      });
    });
  }

  async purgePrefix(bucket: string, prefix: string): Promise<Result<number, StorageUnavailable>> {
    let totalDeleted = 0;
    let continuationToken: string | undefined;
    do {
      const listed = await this.listObjects({
        bucket,
        prefix,
        continuationToken,
        maxKeys: 1000,
      });
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

  /** A missing object is a failure here as it is in S3: `getObject` has no absent answer. */
  async getObject(bucket: string, key: string): Promise<Result<Buffer, StorageUnavailable>> {
    return measureStorageOp('get', bucket, async () => {
      const item = this.storage.get(this.getStorageKey(bucket, key));
      return item ? ok(item.data) : err(storageUnavailable('getObject', `${bucket}/${key}`));
    });
  }

  async createPresignedPutUrl(
    params: StoragePresignedPutParams
  ): Promise<Result<StoragePresignedPutResult, StorageUnavailable>> {
    const expiresIn = params.expiresInSeconds;
    return ok({
      url: `http://localhost:9000/${params.bucket}/${params.key}?mock-presigned=true`,
      headers: {
        'content-type': params.contentType,
        'content-length': String(params.contentLength ?? 0),
      },
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    });
  }

  async createPresignedGetUrl(
    params: StoragePresignedGetParams
  ): Promise<Result<string, StorageUnavailable>> {
    return ok(`http://localhost:9000/${params.bucket}/${params.key}?mock-presigned-get=true`);
  }

  async close(): Promise<Result<void, StorageUnavailable>> {
    this.storage.clear();
    return ok();
  }
}

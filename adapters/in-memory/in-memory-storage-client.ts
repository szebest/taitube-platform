import * as fs from 'node:fs';
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
import { measureStorageOp } from '../storage-metrics-helper.js';

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

  async checkHealth(): Promise<boolean> {
    return this.isHealthy;
  }

  async uploadObject(params: StorageUploadParams): Promise<StorageUploadResult> {
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

      return {
        key: params.key,
        etag,
      };
    });
  }

  async downloadObject(bucket: string, key: string, targetFilePath: string): Promise<boolean> {
    return measureStorageOp('get', bucket, async () => {
      const item = this.storage.get(this.getStorageKey(bucket, key));
      if (!item) {
        return false;
      }
      fs.writeFileSync(targetFilePath, item.data);
      return true;
    });
  }

  async headObject(bucket: string, key: string): Promise<StorageObjectMetadata | null> {
    return measureStorageOp('head', bucket, async () => {
      const item = this.storage.get(this.getStorageKey(bucket, key));
      if (!item) {
        return null;
      }
      return {
        contentLength: item.data.length,
        contentType: item.contentType,
        cacheControl: item.cacheControl,
        etag: item.etag,
      };
    });
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    return measureStorageOp('delete', bucket, async () => {
      this.storage.delete(this.getStorageKey(bucket, key));
    });
  }

  async deleteObjects(bucket: string, keys: string[]): Promise<StorageDeleteObjectsResult> {
    const deleted: string[] = [];
    return measureStorageOp('delete', bucket, async () => {
      for (const key of keys) {
        this.storage.delete(this.getStorageKey(bucket, key));
        deleted.push(key);
      }
      return { deletedKeys: deleted };
    });
  }

  async listObjects(params: StorageListObjectsParams): Promise<StorageListObjectsResult> {
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

      const maxKeys = params.maxKeys ?? 1000;
      let filteredKeys = matchingKeys;
      if (params.continuationToken) {
        const token = params.continuationToken;
        filteredKeys = matchingKeys.filter((k) => k > token);
      }

      const slice = filteredKeys.slice(0, maxKeys);
      const isTruncated = filteredKeys.length > maxKeys;
      const lastKey = slice.length > 0 ? slice[slice.length - 1] : undefined;
      return {
        keys: slice,
        nextContinuationToken: isTruncated ? lastKey : undefined,
        isTruncated,
      };
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

  async getObject(bucket: string, key: string): Promise<Buffer> {
    return measureStorageOp('get', bucket, async () => {
      const item = this.storage.get(this.getStorageKey(bucket, key));
      if (!item) {
        throw new StorageError(`Object not found: ${bucket}/${key}`);
      }
      return item.data;
    });
  }

  async createPresignedPutUrl(
    params: StoragePresignedPutParams
  ): Promise<StoragePresignedPutResult> {
    const expiresIn = params.expiresInSeconds ?? 900;
    return {
      url: `http://localhost:9000/${params.bucket}/${params.key}?mock-presigned=true`,
      headers: {
        'content-type': params.contentType,
        'content-length': String(params.contentLength ?? 0),
      },
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async createPresignedGetUrl(params: StoragePresignedGetParams): Promise<string> {
    return `http://localhost:9000/${params.bucket}/${params.key}?mock-presigned-get=true`;
  }

  async close(): Promise<void> {
    this.storage.clear();
  }
}

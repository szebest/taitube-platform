import * as fs from 'node:fs';
import {
  StorageClient,
  StorageError,
  type StorageObjectMetadata,
  type StoragePresignedPutParams,
  type StoragePresignedPutResult,
  type StorageUploadParams,
  type StorageUploadResult,
} from '@vp/core/ports';

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
  }

  async downloadObject(bucket: string, key: string, targetFilePath: string): Promise<boolean> {
    const item = this.storage.get(this.getStorageKey(bucket, key));
    if (!item) {
      return false;
    }
    fs.writeFileSync(targetFilePath, item.data);
    return true;
  }

  async headObject(bucket: string, key: string): Promise<StorageObjectMetadata | null> {
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
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    this.storage.delete(this.getStorageKey(bucket, key));
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    const item = this.storage.get(this.getStorageKey(bucket, key));
    if (!item) {
      throw new StorageError(`Object not found: ${bucket}/${key}`);
    }
    return item.data;
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

  async close(): Promise<void> {
    this.storage.clear();
  }
}

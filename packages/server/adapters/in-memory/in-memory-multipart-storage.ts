import {
  MultipartStorage,
  type StorageClient,
  type StorageCompletePartInput,
  StorageError,
  type StorageMultipartUploadInfo,
  type StoragePresignedPartInfo,
  type StoragePresignedPartParams,
  type StorageUploadedPartInfo,
} from '@vp/core/ports';
import { measureStorageOp } from '../storage-metrics-helper';

interface InFlightPart {
  partNumber: number;
  data: Buffer;
  etag: string;
}

interface InFlightUpload {
  bucket: string;
  key: string;
  contentType: string;
  parts: Map<number, InFlightPart>;
}

export class InMemoryMultipartStorage extends MultipartStorage {
  private readonly uploads = new Map<string, InFlightUpload>();
  private readonly storageClient?: StorageClient;

  constructor(storageClient?: StorageClient) {
    super();
    this.storageClient = storageClient;
  }

  async checkHealth(): Promise<boolean> {
    return true;
  }

  async createMultipartUpload(bucket: string, key: string, contentType: string): Promise<string> {
    return measureStorageOp('multipart', bucket, async () => {
      const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.uploads.set(uploadId, {
        bucket,
        key,
        contentType,
        parts: new Map(),
      });
      return uploadId;
    });
  }

  async createPresignedPartUrl(
    params: StoragePresignedPartParams
  ): Promise<StoragePresignedPartInfo> {
    const expiresIn = params.expiresInSeconds ?? 900;
    return {
      partNumber: params.partNumber,
      url: `http://localhost:9000/${params.bucket}/${params.key}?uploadId=${params.uploadId}&partNumber=${params.partNumber}&mock-presigned-part=true`,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  seedPart(uploadId: string, partNumber: number, data: Buffer): void {
    const upload = this.uploads.get(uploadId);
    if (!upload) {
      throw new StorageError(`Upload not found: ${uploadId}`);
    }
    const etag = `etag-part-${partNumber}-${Math.random().toString(36).slice(2, 8)}`;
    upload.parts.set(partNumber, { partNumber, data, etag });
  }

  async listMultipartParts(
    _bucket: string,
    _key: string,
    uploadId: string
  ): Promise<StorageUploadedPartInfo[]> {
    const upload = this.uploads.get(uploadId);
    if (!upload) {
      return [];
    }
    return Array.from(upload.parts.values()).map((p) => ({
      partNumber: p.partNumber,
      etag: p.etag,
      size: p.data.length,
    }));
  }

  async listMultipartUploads(
    bucket: string,
    prefix?: string
  ): Promise<StorageMultipartUploadInfo[]> {
    const result: StorageMultipartUploadInfo[] = [];
    for (const [uploadId, upload] of this.uploads.entries()) {
      if (upload.bucket === bucket) {
        if (!prefix || upload.key.startsWith(prefix)) {
          result.push({
            uploadId,
            key: upload.key,
          });
        }
      }
    }
    return result;
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: StorageCompletePartInput[]
  ): Promise<void> {
    const upload = this.uploads.get(uploadId);
    if (!upload) {
      throw new StorageError(`Upload not found: ${uploadId}`);
    }

    const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const chunks: Buffer[] = [];
    for (const p of sortedParts) {
      const part = upload.parts.get(p.partNumber);
      if (part) {
        chunks.push(part.data);
      }
    }
    const fullBody = Buffer.concat(chunks);

    if (this.storageClient) {
      await this.storageClient.uploadObject({
        bucket,
        key,
        body: fullBody,
        contentType: upload.contentType,
      });
    }

    this.uploads.delete(uploadId);
  }

  async abortMultipartUpload(_bucket: string, _key: string, uploadId: string): Promise<void> {
    this.uploads.delete(uploadId);
  }

  async close(): Promise<void> {
    this.uploads.clear();
  }
}

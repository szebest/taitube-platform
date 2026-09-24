import {
  MultipartStorage,
  type StorageClient,
  type StorageCompletePartInput,
  type StorageMultipartUploadInfo,
  type StoragePresignedPartInfo,
  type StoragePresignedPartParams,
  type StorageUploadedPartInfo,
} from '@vp/core/ports';
import { MS_PER_SECOND } from '@vp/domain/time';
import { type StorageUnavailable, storageUnavailable } from '@vp/errors';
import { type Result, err, ok } from '@vp/result';

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

  async checkHealth(): Promise<Result<void, StorageUnavailable>> {
    return ok();
  }

  async createMultipartUpload(
    bucket: string,
    key: string,
    contentType: string
  ): Promise<Result<string, StorageUnavailable>> {
    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.uploads.set(uploadId, {
      bucket,
      key,
      contentType,
      parts: new Map(),
    });
    return ok(uploadId);
  }

  async createPresignedPartUrl(
    params: StoragePresignedPartParams
  ): Promise<Result<StoragePresignedPartInfo, StorageUnavailable>> {
    const expiresIn = params.expiresInSeconds;
    return ok({
      partNumber: params.partNumber,
      url: `http://localhost:9000/${params.bucket}/${params.key}?uploadId=${params.uploadId}&partNumber=${params.partNumber}&mock-presigned-part=true`,
      expiresAt: new Date(Date.now() + expiresIn * MS_PER_SECOND).toISOString(),
    });
  }

  /** Test seam: a part arrives through a presigned PUT in production, which no double can serve. */
  seedPart(uploadId: string, partNumber: number, data: Buffer): Result<void, StorageUnavailable> {
    const upload = this.uploads.get(uploadId);
    if (!upload) return err(storageUnavailable('seedPart', uploadId));
    const etag = `etag-part-${partNumber}-${Math.random().toString(36).slice(2, 8)}`;
    upload.parts.set(partNumber, { partNumber, data, etag });
    return ok();
  }

  async listMultipartParts(
    _bucket: string,
    _key: string,
    uploadId: string
  ): Promise<Result<StorageUploadedPartInfo[], StorageUnavailable>> {
    const upload = this.uploads.get(uploadId);
    if (!upload) {
      return ok([]);
    }
    return ok(
      Array.from(upload.parts.values()).map((p) => ({
        partNumber: p.partNumber,
        etag: p.etag,
        size: p.data.length,
      }))
    );
  }

  async listMultipartUploads(
    bucket: string,
    prefix?: string
  ): Promise<Result<StorageMultipartUploadInfo[], StorageUnavailable>> {
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
    return ok(result);
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: readonly StorageCompletePartInput[]
  ): Promise<Result<void, StorageUnavailable>> {
    const upload = this.uploads.get(uploadId);
    if (!upload) {
      return err(storageUnavailable('completeMultipartUpload', uploadId));
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
      const uploaded = await this.storageClient.uploadObject({
        bucket,
        key,
        body: fullBody,
        contentType: upload.contentType,
      });
      if (!uploaded.ok) return uploaded;
    }

    this.uploads.delete(uploadId);
    return ok();
  }

  async abortMultipartUpload(
    _bucket: string,
    _key: string,
    uploadId: string
  ): Promise<Result<void, StorageUnavailable>> {
    this.uploads.delete(uploadId);
    return ok();
  }

  clear(): void {
    this.uploads.clear();
  }

  async close(): Promise<Result<void, StorageUnavailable>> {
    this.clear();
    return ok();
  }
}

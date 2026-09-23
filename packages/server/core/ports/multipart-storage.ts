import type { StorageUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { HealthCheckable } from './health-checkable';

export interface StoragePresignedPartParams {
  bucket: string;
  key: string;
  uploadId: string;
  partNumber: number;
  expiresInSeconds?: number;
}

export interface StoragePresignedPartInfo {
  partNumber: number;
  url: string;
  expiresAt: string;
}

export interface StorageUploadedPartInfo {
  partNumber: number;
  etag: string;
  size: number;
}

export interface StorageCompletePartInput {
  partNumber: number;
  etag: string;
}

export interface StorageMultipartUploadInfo {
  uploadId: string;
  key: string;
  initiated?: Date;
}

export abstract class MultipartStorage implements HealthCheckable<StorageUnavailable> {
  abstract checkHealth(): Promise<Result<void, StorageUnavailable>>;
  abstract createMultipartUpload(
    bucket: string,
    key: string,
    contentType: string
  ): Promise<Result<string, StorageUnavailable>>;
  abstract createPresignedPartUrl(
    params: StoragePresignedPartParams
  ): Promise<Result<StoragePresignedPartInfo, StorageUnavailable>>;
  abstract listMultipartParts(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<Result<StorageUploadedPartInfo[], StorageUnavailable>>;
  abstract listMultipartUploads(
    bucket: string,
    prefix?: string
  ): Promise<Result<StorageMultipartUploadInfo[], StorageUnavailable>>;
  abstract completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: StorageCompletePartInput[]
  ): Promise<Result<void, StorageUnavailable>>;
  abstract abortMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<Result<void, StorageUnavailable>>;
  abstract close(): Promise<Result<void, StorageUnavailable>>;
}

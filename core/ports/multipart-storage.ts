import type { HealthCheckable } from './health-checkable.js';

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

export abstract class MultipartStorage implements HealthCheckable {
  abstract checkHealth(): Promise<boolean>;
  abstract createMultipartUpload(bucket: string, key: string, contentType: string): Promise<string>;
  abstract createPresignedPartUrl(
    params: StoragePresignedPartParams
  ): Promise<StoragePresignedPartInfo>;
  abstract listMultipartParts(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<StorageUploadedPartInfo[]>;
  abstract listMultipartUploads(
    bucket: string,
    prefix?: string
  ): Promise<StorageMultipartUploadInfo[]>;
  abstract completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: StorageCompletePartInput[]
  ): Promise<void>;
  abstract abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void>;
  abstract close(): Promise<void>;
}

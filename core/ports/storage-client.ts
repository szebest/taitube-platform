import type { HealthCheckable } from './health-checkable.js';

export class StorageError extends Error {
  readonly code?: string;
  override readonly cause?: unknown;

  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message);
    this.name = 'StorageError';
    this.code = options?.code;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type StorageBody = Buffer | Uint8Array | NodeJS.ReadableStream | string;

export interface StorageUploadParams {
  bucket: string;
  key: string;
  body: StorageBody;
  contentType: string;
  cacheControl?: string;
}

export interface StorageUploadResult {
  key: string;
  etag?: string;
}

export interface StorageObjectMetadata {
  contentLength: number;
  contentType?: string;
  cacheControl?: string;
  etag?: string;
}

export interface StoragePresignedPutParams {
  bucket: string;
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}

export interface StoragePresignedPutResult {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export abstract class StorageClient implements HealthCheckable {
  abstract checkHealth(): Promise<boolean>;
  abstract uploadObject(params: StorageUploadParams): Promise<StorageUploadResult>;
  abstract downloadObject(bucket: string, key: string, targetFilePath: string): Promise<boolean>;
  abstract headObject(bucket: string, key: string): Promise<StorageObjectMetadata | null>;
  abstract deleteObject(bucket: string, key: string): Promise<void>;
  abstract getObject(bucket: string, key: string): Promise<Buffer>;
  abstract createPresignedPutUrl(
    params: StoragePresignedPutParams
  ): Promise<StoragePresignedPutResult>;
  abstract close(): Promise<void>;
}

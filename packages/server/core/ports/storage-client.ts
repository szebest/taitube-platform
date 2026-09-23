import type { StorageUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { HealthCheckable } from './health-checkable';

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

export interface StoragePresignedGetParams {
  bucket: string;
  key: string;
  expiresInSeconds?: number;
}

export interface StorageListObjectsParams {
  bucket: string;
  prefix?: string;
  continuationToken?: string;
  maxKeys?: number;
}

export interface StorageListObjectsResult {
  keys: string[];
  nextContinuationToken?: string;
  isTruncated: boolean;
}

export interface StorageDeleteObjectsResult {
  deletedKeys: string[];
}

export abstract class StorageClient implements HealthCheckable<StorageUnavailable> {
  abstract checkHealth(): Promise<Result<void, StorageUnavailable>>;
  abstract uploadObject(
    params: StorageUploadParams
  ): Promise<Result<StorageUploadResult, StorageUnavailable>>;
  abstract downloadObject(
    bucket: string,
    key: string,
    targetFilePath: string
  ): Promise<Result<boolean, StorageUnavailable>>;
  /** A missing object is `ok(null)`: absence is not a failure. */
  abstract headObject(
    bucket: string,
    key: string
  ): Promise<Result<StorageObjectMetadata | null, StorageUnavailable>>;
  abstract deleteObject(bucket: string, key: string): Promise<Result<void, StorageUnavailable>>;
  abstract deleteObjects(
    bucket: string,
    keys: string[]
  ): Promise<Result<StorageDeleteObjectsResult, StorageUnavailable>>;
  abstract listObjects(
    params: StorageListObjectsParams
  ): Promise<Result<StorageListObjectsResult, StorageUnavailable>>;
  abstract purgePrefix(bucket: string, prefix: string): Promise<Result<number, StorageUnavailable>>;
  abstract getObject(bucket: string, key: string): Promise<Result<Buffer, StorageUnavailable>>;
  abstract createPresignedPutUrl(
    params: StoragePresignedPutParams
  ): Promise<Result<StoragePresignedPutResult, StorageUnavailable>>;
  abstract createPresignedGetUrl(
    params: StoragePresignedGetParams
  ): Promise<Result<string, StorageUnavailable>>;
  abstract close(): Promise<Result<void, StorageUnavailable>>;
}

import {
  StorageClient,
  type StorageListObjectsParams,
  type StoragePresignedGetParams,
  type StoragePresignedPutParams,
  type StorageUploadParams,
} from '@vp/core/ports';
import type { StorageUnavailable } from '@vp/errors';
import type { PipelineMetrics } from '@vp/observability';
import type { Result } from '@vp/result';
import { type StorageOp, meterStorageOp } from './storage-op-meter';

type Outcome<M extends keyof StorageClient> = ReturnType<StorageClient[M]>;

/**
 * Wraps either family's storage so every object call is counted the same way, and neither the S3
 * adapter nor the in-memory double carries a metrics dependency of its own.
 */
export class MeteredStorageClient extends StorageClient {
  constructor(
    readonly inner: StorageClient,
    private readonly metrics: PipelineMetrics
  ) {
    super();
  }

  private meter<T>(
    op: StorageOp,
    bucket: string,
    call: () => Promise<Result<T, StorageUnavailable>>
  ): Promise<Result<T, StorageUnavailable>> {
    return meterStorageOp(this.metrics, op, bucket, call);
  }

  checkHealth(): Outcome<'checkHealth'> {
    return this.inner.checkHealth();
  }

  uploadObject(params: StorageUploadParams): Outcome<'uploadObject'> {
    return this.meter('put', params.bucket, () => this.inner.uploadObject(params));
  }

  downloadObject(bucket: string, key: string, target: string): Outcome<'downloadObject'> {
    return this.meter('get', bucket, () => this.inner.downloadObject(bucket, key, target));
  }

  headObject(bucket: string, key: string): Outcome<'headObject'> {
    return this.meter('head', bucket, () => this.inner.headObject(bucket, key));
  }

  deleteObject(bucket: string, key: string): Outcome<'deleteObject'> {
    return this.meter('delete', bucket, () => this.inner.deleteObject(bucket, key));
  }

  deleteObjects(bucket: string, keys: string[]): Outcome<'deleteObjects'> {
    return this.meter('delete', bucket, () => this.inner.deleteObjects(bucket, keys));
  }

  listObjects(params: StorageListObjectsParams): Outcome<'listObjects'> {
    return this.meter('list', params.bucket, () => this.inner.listObjects(params));
  }

  purgePrefix(bucket: string, prefix: string): Outcome<'purgePrefix'> {
    return this.meter('delete', bucket, () => this.inner.purgePrefix(bucket, prefix));
  }

  getObject(bucket: string, key: string): Outcome<'getObject'> {
    return this.meter('get', bucket, () => this.inner.getObject(bucket, key));
  }

  createPresignedPutUrl(params: StoragePresignedPutParams): Outcome<'createPresignedPutUrl'> {
    return this.inner.createPresignedPutUrl(params);
  }

  createPresignedGetUrl(params: StoragePresignedGetParams): Outcome<'createPresignedGetUrl'> {
    return this.inner.createPresignedGetUrl(params);
  }

  close(): Outcome<'close'> {
    return this.inner.close();
  }
}

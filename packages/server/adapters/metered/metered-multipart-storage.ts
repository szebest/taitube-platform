import {
  MultipartStorage,
  type StorageCompletePartInput,
  type StoragePresignedPartParams,
} from '@vp/core/ports';
import type { PipelineMetrics } from '@vp/observability';
import { meterStorageOp } from './storage-op-meter';

type Outcome<M extends keyof MultipartStorage> = ReturnType<MultipartStorage[M]>;

/** The multipart half of `MeteredStorageClient`: every session call counts as `multipart`. */
export class MeteredMultipartStorage extends MultipartStorage {
  constructor(
    readonly inner: MultipartStorage,
    private readonly metrics: PipelineMetrics
  ) {
    super();
  }

  checkHealth(): Outcome<'checkHealth'> {
    return this.inner.checkHealth();
  }

  createMultipartUpload(
    bucket: string,
    key: string,
    contentType: string
  ): Outcome<'createMultipartUpload'> {
    return meterStorageOp(this.metrics, 'multipart', bucket, () =>
      this.inner.createMultipartUpload(bucket, key, contentType)
    );
  }

  createPresignedPartUrl(params: StoragePresignedPartParams): Outcome<'createPresignedPartUrl'> {
    return this.inner.createPresignedPartUrl(params);
  }

  listMultipartParts(bucket: string, key: string, uploadId: string): Outcome<'listMultipartParts'> {
    return meterStorageOp(this.metrics, 'multipart', bucket, () =>
      this.inner.listMultipartParts(bucket, key, uploadId)
    );
  }

  listMultipartUploads(bucket: string, prefix?: string): Outcome<'listMultipartUploads'> {
    return meterStorageOp(this.metrics, 'multipart', bucket, () =>
      this.inner.listMultipartUploads(bucket, prefix)
    );
  }

  completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: readonly StorageCompletePartInput[]
  ): Outcome<'completeMultipartUpload'> {
    return meterStorageOp(this.metrics, 'multipart', bucket, () =>
      this.inner.completeMultipartUpload(bucket, key, uploadId, parts)
    );
  }

  abortMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string
  ): Outcome<'abortMultipartUpload'> {
    return meterStorageOp(this.metrics, 'multipart', bucket, () =>
      this.inner.abortMultipartUpload(bucket, key, uploadId)
    );
  }

  close(): Outcome<'close'> {
    return this.inner.close();
  }
}

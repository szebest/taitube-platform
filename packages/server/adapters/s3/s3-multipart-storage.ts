import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListMultipartUploadsCommand,
  ListPartsCommand,
  type S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  MultipartStorage,
  type StorageCompletePartInput,
  type StorageMultipartUploadInfo,
  type StoragePresignedPartInfo,
  type StoragePresignedPartParams,
  type StorageUploadedPartInfo,
} from '@vp/core/ports';
import { MS_PER_SECOND } from '@vp/domain/time';
import { type StorageUnavailable, storageUnavailable } from '@vp/errors';
import { type Result, fromPromise, map, ok } from '@vp/result';
import { S3StorageClient, type S3StorageClientConfig } from './s3-storage-client';

export type S3MultipartStorageConfig =
  | { type: 'storage'; storageClient: S3StorageClient }
  | S3StorageClientConfig;

export class S3MultipartStorage extends MultipartStorage {
  private readonly client: S3Client;
  private readonly storage: S3StorageClient;

  constructor(config: S3MultipartStorageConfig) {
    super();
    this.storage = config.type === 'storage' ? config.storageClient : new S3StorageClient(config);
    this.client = this.storage.getRawClient();
  }

  private unavailable(operation: string) {
    return (cause: unknown): StorageUnavailable => storageUnavailable(operation, cause);
  }

  checkHealth(): Promise<Result<void, StorageUnavailable>> {
    return this.storage.checkHealth();
  }

  async createMultipartUpload(
    bucket: string,
    key: string,
    contentType: string
  ): Promise<Result<string, StorageUnavailable>> {
    return fromPromise(async () => {
      const res = await this.client.send(
        new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType })
      );
      if (!res.UploadId) throw new Error('No UploadId returned from S3 createMultipartUpload');
      return res.UploadId;
    }, this.unavailable('createMultipartUpload'));
  }

  async createPresignedPartUrl(
    params: StoragePresignedPartParams
  ): Promise<Result<StoragePresignedPartInfo, StorageUnavailable>> {
    const expiresIn = params.expiresInSeconds;
    const signed = await fromPromise(
      () =>
        getSignedUrl(
          this.client,
          new UploadPartCommand({
            Bucket: params.bucket,
            Key: params.key,
            UploadId: params.uploadId,
            PartNumber: params.partNumber,
          }),
          { expiresIn }
        ),
      this.unavailable('createPresignedPartUrl')
    );

    return map(signed, (url) => ({
      partNumber: params.partNumber,
      url,
      expiresAt: new Date(Date.now() + expiresIn * MS_PER_SECOND).toISOString(),
    }));
  }

  async listMultipartParts(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<Result<StorageUploadedPartInfo[], StorageUnavailable>> {
    const listed = await fromPromise(
      () =>
        this.client.send(new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId })),
      this.unavailable('listMultipartParts')
    );

    return map(
      listed,
      (res) =>
        res.Parts?.map((p) => ({
          partNumber: p.PartNumber ?? 0,
          etag: (p.ETag ?? '').replace(/"/g, ''),
          size: p.Size ?? 0,
        })) ?? []
    );
  }

  async listMultipartUploads(
    bucket: string,
    prefix?: string
  ): Promise<Result<StorageMultipartUploadInfo[], StorageUnavailable>> {
    const listed = await fromPromise(
      () => this.client.send(new ListMultipartUploadsCommand({ Bucket: bucket, Prefix: prefix })),
      this.unavailable('listMultipartUploads')
    );

    return map(
      listed,
      (res) =>
        res.Uploads?.map((u) => ({
          uploadId: u.UploadId ?? '',
          key: u.Key ?? '',
          initiated: u.Initiated,
        })) ?? []
    );
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: StorageCompletePartInput[]
  ): Promise<Result<void, StorageUnavailable>> {
    const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const sent = await fromPromise(
      () =>
        this.client.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucket,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
              Parts: sorted.map((p) => ({
                PartNumber: p.partNumber,
                ETag: p.etag.startsWith('"') ? p.etag : `"${p.etag}"`,
              })),
            },
          })
        ),
      this.unavailable('completeMultipartUpload')
    );

    return map(sent, () => undefined);
  }

  async abortMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<Result<void, StorageUnavailable>> {
    const sent = await fromPromise(
      () =>
        this.client.send(
          new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId })
        ),
      this.unavailable('abortMultipartUpload')
    );

    return map(sent, () => undefined);
  }

  async close(): Promise<Result<void, StorageUnavailable>> {
    return ok();
  }
}

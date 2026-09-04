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
  StorageError,
  type StorageMultipartUploadInfo,
  type StoragePresignedPartInfo,
  type StoragePresignedPartParams,
  type StorageUploadedPartInfo,
} from '@vp/core/ports';
import { S3StorageClient, type S3StorageClientConfig } from './s3-storage-client.js';

export interface S3MultipartStorageConfig extends S3StorageClientConfig {
  storageClient?: S3StorageClient;
}

export class S3MultipartStorage extends MultipartStorage {
  private readonly client: S3Client;

  constructor(config: S3MultipartStorageConfig = {}) {
    super();
    if (config.storageClient) {
      this.client = config.storageClient.getRawClient();
    } else {
      this.client = new S3StorageClient(config).getRawClient();
    }
  }

  async checkHealth(): Promise<boolean> {
    return true;
  }

  async createMultipartUpload(bucket: string, key: string, contentType: string): Promise<string> {
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      });
      const res = await this.client.send(command);
      if (!res.UploadId) {
        throw new Error('No UploadId returned from S3 createMultipartUpload');
      }
      return res.UploadId;
    } catch (err: unknown) {
      throw new StorageError(
        `Failed to create multipart upload for ${key}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async createPresignedPartUrl(
    params: StoragePresignedPartParams
  ): Promise<StoragePresignedPartInfo> {
    try {
      const expiresIn = params.expiresInSeconds ?? 900;
      const command = new UploadPartCommand({
        Bucket: params.bucket,
        Key: params.key,
        UploadId: params.uploadId,
        PartNumber: params.partNumber,
      });

      const url = await getSignedUrl(this.client, command, {
        expiresIn,
      });

      return {
        partNumber: params.partNumber,
        url,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      };
    } catch (err: unknown) {
      throw new StorageError(
        `Failed to create presigned part url for ${params.key} part ${params.partNumber}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async listMultipartParts(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<StorageUploadedPartInfo[]> {
    try {
      const command = new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      });
      const res = await this.client.send(command);
      return (
        res.Parts?.map((p) => ({
          partNumber: p.PartNumber ?? 0,
          etag: (p.ETag ?? '').replace(/"/g, ''),
          size: p.Size ?? 0,
        })) ?? []
      );
    } catch (err: unknown) {
      throw new StorageError(
        `Failed to list multipart parts for upload ${uploadId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async listMultipartUploads(
    bucket: string,
    prefix?: string
  ): Promise<StorageMultipartUploadInfo[]> {
    try {
      const command = new ListMultipartUploadsCommand({
        Bucket: bucket,
        Prefix: prefix,
      });
      const res = await this.client.send(command);
      return (
        res.Uploads?.map((u) => ({
          uploadId: u.UploadId ?? '',
          key: u.Key ?? '',
          initiated: u.Initiated,
        })) ?? []
      );
    } catch (err: unknown) {
      throw new StorageError(
        `Failed to list multipart uploads for bucket ${bucket}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: StorageCompletePartInput[]
  ): Promise<void> {
    try {
      const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
      const command = new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sorted.map((p) => ({
            PartNumber: p.partNumber,
            ETag: p.etag.startsWith('"') ? p.etag : `"${p.etag}"`,
          })),
        },
      });
      await this.client.send(command);
    } catch (err: unknown) {
      throw new StorageError(
        `Failed to complete multipart upload ${uploadId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      });
      await this.client.send(command);
    } catch (err: unknown) {
      throw new StorageError(
        `Failed to abort multipart upload ${uploadId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
  }

  async close(): Promise<void> {}
}

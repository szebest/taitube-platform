import { expectOk } from '@vp/testing/result';
import { S3MultipartStorage } from '../../s3/s3-multipart-storage';
import { S3StorageClient } from '../../s3/s3-storage-client';
import {
  inMemoryMultipartStorageSubject,
  inMemoryStorageClientSubject,
} from './in-memory-port-subjects';
import type { MultipartStorageSubject } from './multipart-storage.contract';
import { type RealServices, claimRealServices } from './real-services';
import type { StorageClientSubject } from './storage-client.contract';

async function connectedStorage(services: RealServices): Promise<S3StorageClient> {
  const { bucket, ...connection } = services.s3;
  const storage = new S3StorageClient({ type: 'connection', healthBucket: bucket, ...connection });
  expectOk(await storage.checkHealth());
  return storage;
}

/** The double in `unit` and under `bun test`; the MinIO the integration run points at otherwise. */
export async function s3StorageClientSubject(): Promise<StorageClientSubject> {
  const services = claimRealServices();
  if (!services) return inMemoryStorageClientSubject();

  const storage = await connectedStorage(services);
  return {
    storage,
    bucket: services.s3.bucket,
    close: async () => {
      expectOk(await storage.close());
    },
  };
}

async function putPartThroughPresignedUrl(
  multipart: S3MultipartStorage,
  bucket: string,
  target: { key: string; uploadId: string; partNumber: number; data: Buffer }
): Promise<void> {
  const { key, uploadId, partNumber, data } = target;
  const part = expectOk(
    await multipart.createPresignedPartUrl({
      bucket,
      key,
      uploadId,
      partNumber,
      expiresInSeconds: 60,
    })
  );
  const response = await fetch(part.url, { method: 'PUT', body: data });
  if (!response.ok) throw new Error(`part ${partNumber} PUT answered ${response.status}`);
}

/** The double in `unit` and under `bun test`; the MinIO the integration run points at otherwise. */
export async function s3MultipartStorageSubject(): Promise<MultipartStorageSubject> {
  const services = claimRealServices();
  if (!services) return inMemoryMultipartStorageSubject();

  const storage = await connectedStorage(services);
  const multipart = new S3MultipartStorage({ type: 'storage', storageClient: storage });
  const bucket = services.s3.bucket;
  return {
    multipart,
    storage,
    bucket,
    putPart: (key, uploadId, partNumber, data) =>
      putPartThroughPresignedUrl(multipart, bucket, { key, uploadId, partNumber, data }),
    close: async () => {
      expectOk(await storage.close());
    },
  };
}

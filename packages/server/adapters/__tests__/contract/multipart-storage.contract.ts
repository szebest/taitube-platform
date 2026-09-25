import { randomUUID } from 'node:crypto';
import type { MultipartStorage, StorageClient } from '@vp/core/ports';
import { expectOk } from '@vp/testing/result';

export interface MultipartStorageSubject {
  readonly multipart: MultipartStorage;
  /** Where a completed upload lands, to read the assembled object back. */
  readonly storage: StorageClient;
  readonly bucket: string;
  /** Delivers a part the way a browser would: a PUT to its presigned URL, or the double's seam. */
  putPart(key: string, uploadId: string, partNumber: number, data: Buffer): Promise<void>;
  close(): Promise<void>;
}

export type MakeMultipartStorageSubject = () => Promise<MultipartStorageSubject>;

/** S3 refuses a part under 5 MiB unless it is the last one. */
const FIRST_PART = Buffer.alloc(5 * 1024 * 1024, 'a');
const LAST_PART = Buffer.from('tail');

export function describeMultipartStorageContract(makeSubject: MakeMultipartStorageSubject): void {
  describe('MultipartStorage contract', () => {
    let subject: MultipartStorageSubject;
    let multipart: MultipartStorage;
    let bucket: string;
    let prefix: string;
    let key: string;

    beforeAll(async () => {
      subject = await makeSubject();
      multipart = subject.multipart;
      bucket = subject.bucket;
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(() => {
      prefix = `contract/${randomUUID()}/`;
      key = `${prefix}source.mp4`;
    });

    /** By the full key: MinIO answers a directory prefix with no uploads, where S3 lists them. */
    afterEach(async () => {
      for (const upload of expectOk(await multipart.listMultipartUploads(bucket, key))) {
        expectOk(await multipart.abortMultipartUpload(bucket, upload.key, upload.uploadId));
      }
      expectOk(await subject.storage.purgePrefix(bucket, prefix));
    });

    it('answers a health check', async () => {
      expectOk(await multipart.checkHealth());
    });

    it('lists an upload it opened under its key', async () => {
      const uploadId = expectOk(await multipart.createMultipartUpload(bucket, key, 'video/mp4'));

      expect(expectOk(await multipart.listMultipartUploads(bucket, key))).toEqual([
        expect.objectContaining({ uploadId, key }),
      ]);
    });

    it('presigns a part URL for the part it names', async () => {
      const uploadId = expectOk(await multipart.createMultipartUpload(bucket, key, 'video/mp4'));

      const part = expectOk(
        await multipart.createPresignedPartUrl({
          bucket,
          key,
          uploadId,
          partNumber: 2,
          expiresInSeconds: 60,
        })
      );

      expect(part.partNumber).toBe(2);
      expect(part.url).toContain('partNumber=2');
    });

    it('assembles the uploaded parts in order into one object', async () => {
      const uploadId = expectOk(await multipart.createMultipartUpload(bucket, key, 'video/mp4'));
      await subject.putPart(key, uploadId, 2, LAST_PART);
      await subject.putPart(key, uploadId, 1, FIRST_PART);

      const parts = expectOk(await multipart.listMultipartParts(bucket, key, uploadId));
      expect(parts.map((part) => [part.partNumber, part.size])).toEqual([
        [1, FIRST_PART.length],
        [2, LAST_PART.length],
      ]);
      expectOk(await multipart.completeMultipartUpload(bucket, key, uploadId, parts));

      const assembled = expectOk(await subject.storage.getObject(bucket, key));
      expect(assembled.length).toBe(FIRST_PART.length + LAST_PART.length);
      expect(assembled.subarray(-LAST_PART.length).toString()).toBe('tail');
      expect(expectOk(await multipart.listMultipartUploads(bucket, key))).toEqual([]);
    });

    it('forgets an upload it aborted', async () => {
      const uploadId = expectOk(await multipart.createMultipartUpload(bucket, key, 'video/mp4'));

      expectOk(await multipart.abortMultipartUpload(bucket, key, uploadId));

      expect(expectOk(await multipart.listMultipartUploads(bucket, key))).toEqual([]);
    });
  });
}

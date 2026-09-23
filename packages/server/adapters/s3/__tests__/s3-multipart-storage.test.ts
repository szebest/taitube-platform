import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { S3MultipartStorage } from '../s3-multipart-storage';
import { S3StorageClient } from '../s3-storage-client';
import { type FakeS3, fakeS3Client } from './fake-s3-client';

const BUCKET = 'raw';
const KEY = '018f0000-0000-7000-8000-000000000001/source.mp4';
const UPLOAD_ID = 's3-upload-1';

function multipartOver(fake: FakeS3): S3MultipartStorage {
  return new S3MultipartStorage({
    type: 'storage',
    storageClient: new S3StorageClient({ type: 'client', client: fake.client }),
  });
}

describe('S3MultipartStorage', () => {
  describe('createMultipartUpload', () => {
    it('returns the upload id the driver minted', async () => {
      const fake = fakeS3Client({ CreateMultipartUploadCommand: () => ({ UploadId: UPLOAD_ID }) });

      expect(
        expectOk(await multipartOver(fake).createMultipartUpload(BUCKET, KEY, 'video/mp4'))
      ).toBe(UPLOAD_ID);
      expect(fake.sent[0]).toMatchObject({
        name: 'CreateMultipartUploadCommand',
        input: { Bucket: BUCKET, Key: KEY, ContentType: 'video/mp4' },
      });
    });

    it('fails when the driver returns no upload id', async () => {
      const fake = fakeS3Client({ CreateMultipartUploadCommand: () => ({}) });

      expect(
        expectErr(await multipartOver(fake).createMultipartUpload(BUCKET, KEY, 'video/mp4')).code
      ).toBe(ErrorCodes.STORAGE_UNAVAILABLE);
    });
  });

  describe('createPresignedPartUrl', () => {
    it('signs a part upload with an ISO expiry', async () => {
      const multipart = new S3MultipartStorage({
        type: 'connection',
        endpoint: 'http://localhost:9000',
        region: 'us-east-1',
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
      });

      const part = expectOk(
        await multipart.createPresignedPartUrl({
          bucket: BUCKET,
          key: KEY,
          uploadId: UPLOAD_ID,
          partNumber: 3,
          expiresInSeconds: 600,
        })
      );

      expect(part.partNumber).toBe(3);
      expect(part.url).toContain('partNumber=3');
      expect(part.url).toContain(`uploadId=${UPLOAD_ID}`);
      expect(part.url).toContain('X-Amz-Expires=600');
      expect(new Date(part.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('listMultipartParts', () => {
    it('strips the quotes the driver puts around each etag', async () => {
      const fake = fakeS3Client({
        ListPartsCommand: () => ({
          Parts: [
            { PartNumber: 1, ETag: '"aaa"', Size: 512 },
            { PartNumber: 2, ETag: 'bbb', Size: 256 },
            {},
          ],
        }),
      });

      expect(
        expectOk(await multipartOver(fake).listMultipartParts(BUCKET, KEY, UPLOAD_ID))
      ).toEqual([
        { partNumber: 1, etag: 'aaa', size: 512 },
        { partNumber: 2, etag: 'bbb', size: 256 },
        { partNumber: 0, etag: '', size: 0 },
      ]);
    });

    it('treats a missing Parts as no parts', async () => {
      const fake = fakeS3Client({ ListPartsCommand: () => ({}) });
      expect(
        expectOk(await multipartOver(fake).listMultipartParts(BUCKET, KEY, UPLOAD_ID))
      ).toEqual([]);
    });
  });

  describe('listMultipartUploads', () => {
    it('maps the in-flight uploads under a prefix', async () => {
      const initiated = new Date('2026-01-01T00:00:00.000Z');
      const fake = fakeS3Client({
        ListMultipartUploadsCommand: () => ({
          Uploads: [{ UploadId: UPLOAD_ID, Key: KEY, Initiated: initiated }, {}],
        }),
      });

      expect(expectOk(await multipartOver(fake).listMultipartUploads(BUCKET, 'raw/'))).toEqual([
        { uploadId: UPLOAD_ID, key: KEY, initiated },
        { uploadId: '', key: '', initiated: undefined },
      ]);
      expect(fake.sent[0]?.input).toMatchObject({ Bucket: BUCKET, Prefix: 'raw/' });
    });
  });

  describe('completeMultipartUpload', () => {
    it('sorts the parts and quotes every etag exactly once', async () => {
      const fake = fakeS3Client();

      await multipartOver(fake).completeMultipartUpload(BUCKET, KEY, UPLOAD_ID, [
        { partNumber: 2, etag: '"bbb"' },
        { partNumber: 1, etag: 'aaa' },
      ]);

      expect(fake.sent[0]?.input.MultipartUpload).toEqual({
        Parts: [
          { PartNumber: 1, ETag: '"aaa"' },
          { PartNumber: 2, ETag: '"bbb"' },
        ],
      });
    });

    it('reports a driver failure as STORAGE_UNAVAILABLE naming the operation', async () => {
      const fake = fakeS3Client({
        CompleteMultipartUploadCommand: () => {
          throw new Error('part missing');
        },
      });

      expect(
        expectErr(
          await multipartOver(fake).completeMultipartUpload(BUCKET, KEY, UPLOAD_ID, [
            { partNumber: 1, etag: 'aaa' },
          ])
        )
      ).toMatchObject({
        code: ErrorCodes.STORAGE_UNAVAILABLE,
        operation: 'completeMultipartUpload',
      });
    });
  });

  describe('abortMultipartUpload', () => {
    it('aborts the upload', async () => {
      const fake = fakeS3Client();
      await multipartOver(fake).abortMultipartUpload(BUCKET, KEY, UPLOAD_ID);

      expect(fake.sent[0]).toMatchObject({
        name: 'AbortMultipartUploadCommand',
        input: { Bucket: BUCKET, Key: KEY, UploadId: UPLOAD_ID },
      });
    });

    it('reports a driver failure as STORAGE_UNAVAILABLE', async () => {
      const fake = fakeS3Client({
        AbortMultipartUploadCommand: () => {
          throw new Error('already gone');
        },
      });

      expect(
        expectErr(await multipartOver(fake).abortMultipartUpload(BUCKET, KEY, UPLOAD_ID)).code
      ).toBe(ErrorCodes.STORAGE_UNAVAILABLE);
    });
  });

  describe('cloudflare r2 compatibility', () => {
    const r2Enabled = process.env['STORAGE_E2E_R2'] === '1';

    it.skipIf(!r2Enabled)('drives a real R2 bucket through the same calls', async () => {
      const bucket = process.env['S3_BUCKET_RAW'] || BUCKET;
      const multipart = new S3MultipartStorage({
        type: 'connection',
        endpoint: process.env['S3_ENDPOINT'] ?? '',
        region: process.env['S3_REGION'] ?? 'auto',
        accessKeyId: process.env['S3_ACCESS_KEY_ID'],
        secretAccessKey: process.env['S3_SECRET_ACCESS_KEY'],
      });

      const uploadId = expectOk(await multipart.createMultipartUpload(bucket, KEY, 'video/mp4'));
      expect(uploadId).toBeDefined();

      const part = expectOk(
        await multipart.createPresignedPartUrl({
          bucket,
          key: KEY,
          uploadId,
          partNumber: 1,
          expiresInSeconds: 600,
        })
      );
      expect(part.url).toContain('partNumber=1');
      expect(part.url).toContain('uploadId=');

      await multipart.abortMultipartUpload(bucket, KEY, uploadId);
    });
  });
});

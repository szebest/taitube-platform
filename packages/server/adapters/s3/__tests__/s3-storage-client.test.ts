import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { S3StorageClient } from '../s3-storage-client';
import { type CommandHandler, fakeS3Client, notFound } from './fake-s3-client';

const BUCKET = 'raw';
const KEY = '018f0000-0000-7000-8000-000000000001/source.mp4';

function fakeStorage(handlers?: Record<string, CommandHandler>) {
  const fake = fakeS3Client(handlers);
  return {
    fake,
    storage: new S3StorageClient({ type: 'client', client: fake.client, healthBucket: BUCKET }),
  };
}

describe('S3StorageClient', () => {
  describe('checkHealth', () => {
    it('asks for the bucket it was handed', async () => {
      const { fake, storage } = fakeStorage();

      expectOk(await storage.checkHealth());
      expect(fake.sent).toEqual([{ name: 'HeadBucketCommand', input: { Bucket: BUCKET } }]);
    });

    it('is unavailable when the bucket does not answer', async () => {
      const { storage } = fakeStorage({
        HeadBucketCommand: () => {
          throw new Error('connect ECONNREFUSED');
        },
      });

      expect(expectErr(await storage.checkHealth()).code).toBe(ErrorCodes.STORAGE_UNAVAILABLE);
    });
  });

  describe('uploadObject', () => {
    it('sends the body with its content headers and returns the etag', async () => {
      const { fake, storage } = fakeStorage({ PutObjectCommand: () => ({ ETag: '"abc"' }) });

      const result = expectOk(
        await storage.uploadObject({
          bucket: BUCKET,
          key: KEY,
          body: Buffer.from('payload'),
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=60',
        })
      );

      expect(result).toEqual({ key: KEY, etag: '"abc"' });
      expect(fake.sent[0]).toMatchObject({
        name: 'PutObjectCommand',
        input: {
          Bucket: BUCKET,
          Key: KEY,
          ContentType: 'video/mp4',
          CacheControl: 'public, max-age=60',
        },
      });
    });

    it('reports a driver failure as STORAGE_UNAVAILABLE carrying the cause', async () => {
      const cause = new Error('connection reset');
      const { storage } = fakeStorage({
        PutObjectCommand: () => {
          throw cause;
        },
      });

      expect(
        expectErr(
          await storage.uploadObject({
            bucket: BUCKET,
            key: KEY,
            body: Buffer.from('x'),
            contentType: 'video/mp4',
          })
        )
      ).toMatchObject({ code: ErrorCodes.STORAGE_UNAVAILABLE, operation: 'uploadObject', cause });
    });
  });

  describe('headObject', () => {
    it('maps the metadata the pipeline reads', async () => {
      const { storage } = fakeStorage({
        HeadObjectCommand: () => ({
          ContentLength: 2048,
          ContentType: 'video/mp4',
          CacheControl: 'no-cache',
          ETag: '"etag"',
        }),
      });

      expect(expectOk(await storage.headObject(BUCKET, KEY))).toEqual({
        contentLength: 2048,
        contentType: 'video/mp4',
        cacheControl: 'no-cache',
        etag: '"etag"',
      });
    });

    it.each([
      { scenario: 'NotFound', error: notFound() },
      { scenario: 'NoSuchKey', error: Object.assign(new Error('gone'), { name: 'NoSuchKey' }) },
    ])('returns null on $scenario', async ({ error }) => {
      const { storage } = fakeStorage({
        HeadObjectCommand: () => {
          throw error;
        },
      });

      expect(expectOk(await storage.headObject(BUCKET, KEY))).toBeNull();
    });

    it('reports any other failure as STORAGE_UNAVAILABLE', async () => {
      const { storage } = fakeStorage({
        HeadObjectCommand: () => {
          throw new Error('permission denied');
        },
      });

      expect(expectErr(await storage.headObject(BUCKET, KEY)).code).toBe(
        ErrorCodes.STORAGE_UNAVAILABLE
      );
    });
  });

  describe('getObject', () => {
    it('drains the response stream into one buffer', async () => {
      const { storage } = fakeStorage({
        GetObjectCommand: () => ({ Body: Readable.from([Buffer.from('he'), Buffer.from('llo')]) }),
      });

      const body = expectOk(await storage.getObject(BUCKET, KEY));
      expect(body.toString()).toBe('hello');
    });

    it('fails when the response carries no body', async () => {
      const { storage } = fakeStorage({ GetObjectCommand: () => ({}) });

      expect(expectErr(await storage.getObject(BUCKET, KEY)).code).toBe(
        ErrorCodes.STORAGE_UNAVAILABLE
      );
    });
  });

  describe('downloadObject', () => {
    let targetDir: string;

    beforeEach(() => {
      targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-s3-'));
    });

    afterEach(() => {
      fs.rmSync(targetDir, { recursive: true, force: true });
    });

    it('streams the object to disk', async () => {
      const { storage } = fakeStorage({
        GetObjectCommand: () => ({ Body: Readable.from([Buffer.from('on disk')]) }),
      });
      const target = path.join(targetDir, 'source.mp4');

      expect(expectOk(await storage.downloadObject(BUCKET, KEY, target))).toBe(true);
      expect(fs.readFileSync(target, 'utf8')).toBe('on disk');
    });

    it.each([
      { scenario: 'the object is missing', handler: () => ({}) },
      {
        scenario: 'the driver reports a 404',
        handler: () => {
          throw notFound();
        },
      },
    ])('returns false when $scenario', async ({ handler }) => {
      const { storage } = fakeStorage({ GetObjectCommand: handler });

      expect(
        expectOk(await storage.downloadObject(BUCKET, KEY, path.join(targetDir, 'missing.mp4')))
      ).toBe(false);
    });
  });

  describe('deletes', () => {
    it('deletes one object', async () => {
      const { fake, storage } = fakeStorage();
      await storage.deleteObject(BUCKET, KEY);

      expect(fake.sent[0]).toMatchObject({
        name: 'DeleteObjectCommand',
        input: { Bucket: BUCKET, Key: KEY },
      });
    });

    it('short-circuits an empty batch without reaching the driver', async () => {
      const { fake, storage } = fakeStorage();

      expect(expectOk(await storage.deleteObjects(BUCKET, []))).toEqual({ deletedKeys: [] });
      expect(fake.sent).toEqual([]);
    });

    it('splits a batch into requests of at most 1000 keys', async () => {
      const { fake, storage } = fakeStorage();
      const keys = Array.from({ length: 1001 }, (_, i) => `videos/${i}.ts`);

      const result = expectOk(await storage.deleteObjects(BUCKET, keys));

      expect(result.deletedKeys).toHaveLength(1001);
      expect(fake.sent).toHaveLength(2);
      expect((fake.sent[0]?.input.Delete as { Objects: unknown[] }).Objects).toHaveLength(1000);
      expect((fake.sent[1]?.input.Delete as { Objects: unknown[] }).Objects).toHaveLength(1);
    });
  });

  describe('listObjects', () => {
    it('keeps only usable keys and carries the continuation token', async () => {
      const { storage } = fakeStorage({
        ListObjectsV2Command: () => ({
          Contents: [{ Key: 'a.ts' }, { Key: '' }, {}, { Key: 'b.ts' }],
          NextContinuationToken: 'token-2',
          IsTruncated: true,
        }),
      });

      expect(
        expectOk(
          await storage.listObjects({
            bucket: BUCKET,
            prefix: 'videos/',
            maxKeys: 10,
          })
        )
      ).toEqual({ keys: ['a.ts', 'b.ts'], nextContinuationToken: 'token-2', isTruncated: true });
    });

    it('treats a missing Contents as an empty page', async () => {
      const { storage } = fakeStorage({ ListObjectsV2Command: () => ({}) });

      expect(
        expectOk(
          await storage.listObjects({
            bucket: BUCKET,
          })
        )
      ).toEqual({ keys: [], nextContinuationToken: undefined, isTruncated: false });
    });
  });

  describe('purgePrefix', () => {
    it('walks every page and reports the total deleted', async () => {
      const pages = [
        { Contents: [{ Key: 'a' }, { Key: 'b' }], NextContinuationToken: 'p2', IsTruncated: true },
        { Contents: [{ Key: 'c' }], IsTruncated: false },
      ];
      let page = 0;
      const { fake, storage } = fakeStorage({ ListObjectsV2Command: () => pages[page++] ?? {} });

      expect(expectOk(await storage.purgePrefix(BUCKET, 'videos/'))).toBe(3);
      expect(fake.sent.filter((c) => c.name === 'DeleteObjectsCommand')).toHaveLength(2);
    });

    it('deletes nothing when the prefix is empty', async () => {
      const { fake, storage } = fakeStorage({
        ListObjectsV2Command: () => ({ IsTruncated: false }),
      });

      expect(expectOk(await storage.purgePrefix(BUCKET, 'videos/'))).toBe(0);
      expect(fake.sent.some((c) => c.name === 'DeleteObjectsCommand')).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('destroys the driver on close', async () => {
      const { fake, storage } = fakeStorage();

      await storage.close();
      expect(fake.destroyed()).toBe(true);
    });

    it('hands the raw driver back to the multipart adapter', () => {
      const { fake, storage } = fakeStorage();
      expect(storage.getRawClient()).toBe(fake.client);
    });
  });
});

import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StorageClient } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';

export interface StorageClientSubject {
  readonly storage: StorageClient;
  readonly bucket: string;
  close(): Promise<void>;
}

export type MakeStorageClientSubject = () => Promise<StorageClientSubject>;

export function describeStorageClientContract(makeSubject: MakeStorageClientSubject): void {
  describe('StorageClient contract', () => {
    let subject: StorageClientSubject;
    let storage: StorageClient;
    let bucket: string;
    let prefix: string;
    let downloads: string;

    const put = (key: string, body: string) =>
      storage.uploadObject({ bucket, key: `${prefix}${key}`, body, contentType: 'text/plain' });

    beforeAll(async () => {
      subject = await makeSubject();
      storage = subject.storage;
      bucket = subject.bucket;
      downloads = await mkdtemp(join(tmpdir(), 'storage-contract-'));
    });

    afterAll(async () => {
      await subject.close();
      await rm(downloads, { recursive: true, force: true });
    });

    beforeEach(() => {
      prefix = `contract/${randomUUID()}/`;
    });

    afterEach(async () => {
      expectOk(await storage.purgePrefix(bucket, prefix));
    });

    it('answers a health check', async () => {
      expectOk(await storage.checkHealth());
    });

    it('stores an object and describes it back', async () => {
      expectOk(await put('note.txt', 'hello'));

      expect(expectOk(await storage.headObject(bucket, `${prefix}note.txt`))).toMatchObject({
        contentLength: 5,
        contentType: 'text/plain',
      });
      expect(expectOk(await storage.getObject(bucket, `${prefix}note.txt`)).toString()).toBe(
        'hello'
      );
    });

    it('downloads an object to a file, and answers false for one that is not there', async () => {
      expectOk(await put('note.txt', 'hello'));
      const target = join(downloads, `${randomUUID()}.txt`);

      expect(expectOk(await storage.downloadObject(bucket, `${prefix}note.txt`, target))).toBe(
        true
      );
      expect(await readFile(target, 'utf8')).toBe('hello');
      expect(expectOk(await storage.downloadObject(bucket, `${prefix}absent`, target))).toBe(false);
    });

    it('answers ok(null) from headObject for an object that is not there', async () => {
      expect(expectOk(await storage.headObject(bucket, `${prefix}absent`))).toBeNull();
    });

    it('reports getObject of an object that is not there as STORAGE_UNAVAILABLE', async () => {
      const failure = expectErr(await storage.getObject(bucket, `${prefix}absent`));

      expect(failure.code).toBe(ErrorCodes.STORAGE_UNAVAILABLE);
    });

    it('lists the keys under a prefix in order, page by page', async () => {
      for (const key of ['c', 'a', 'b']) expectOk(await put(key, key));

      const walked: string[] = [];
      let continuationToken: string | undefined;
      for (let page = 0; page < 5; page += 1) {
        const listed = expectOk(
          await storage.listObjects({ bucket, prefix, maxKeys: 2, continuationToken })
        );
        walked.push(...listed.keys);
        if (!listed.isTruncated) break;
        continuationToken = listed.nextContinuationToken;
      }

      expect(walked).toEqual([`${prefix}a`, `${prefix}b`, `${prefix}c`]);
    });

    it('deletes one object, then several, and reports the keys it deleted', async () => {
      for (const key of ['a', 'b', 'c']) expectOk(await put(key, key));

      expectOk(await storage.deleteObject(bucket, `${prefix}a`));
      const removed = expectOk(await storage.deleteObjects(bucket, [`${prefix}b`, `${prefix}c`]));

      expect(removed.deletedKeys).toEqual([`${prefix}b`, `${prefix}c`]);
      expect(expectOk(await storage.listObjects({ bucket, prefix })).keys).toEqual([]);
    });

    it('purges everything under a prefix and counts what it removed', async () => {
      for (const key of ['a', 'nested/b']) expectOk(await put(key, key));

      expect(expectOk(await storage.purgePrefix(bucket, prefix))).toBe(2);
      expect(expectOk(await storage.headObject(bucket, `${prefix}nested/b`))).toBeNull();
    });
  });
}

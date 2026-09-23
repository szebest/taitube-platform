import {
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import type { AuthUser } from '../../plugins/auth';
import { UploadService } from '../upload-service';

const OWNER: AuthUser = { id: '00000000-0000-7000-8000-00000000b001', role: 'CREATOR' };
const STRANGER: AuthUser = { id: '00000000-0000-7000-8000-00000000b002', role: 'CREATOR' };
const MB = 1024 * 1024;

describe('apps/api/services: upload parts', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let service: UploadService;
  let expiredService: UploadService;

  const build = (uploadSessionTtlSeconds?: number) =>
    new UploadService({
      uploads: repositories.uploads,
      videos: repositories.videos,
      events: repositories.events,
      storage,
      multipart: new InMemoryMultipartStorage(storage),
      rawBucket: 'raw',
      multipartThresholdBytes: 10 * MB,
      ...(uploadSessionTtlSeconds === undefined ? {} : { uploadSessionTtlSeconds }),
    });

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    service = build();
    expiredService = build(0);
  });

  const startMultipart = () =>
    service.initiate(OWNER, {
      filename: 'big.mp4',
      sizeBytes: 50 * MB,
      contentType: 'video/mp4',
    });

  const startSingle = () =>
    service.initiate(OWNER, {
      filename: 'small.mp4',
      sizeBytes: MB,
      contentType: 'video/mp4',
    });

  describe('getResumeInfo', () => {
    it('reports the multipart layout and what storage already holds', async () => {
      const { uploadId, partsExpected } = expectOk(await startMultipart());

      expect(expectOk(await service.getResumeInfo(OWNER, uploadId))).toMatchObject({
        status: 'OPEN',
        strategy: 'multipart',
        partsExpected,
        uploadedParts: [],
      });
    });

    it('answers a single PUT upload without consulting storage', async () => {
      const { uploadId } = expectOk(await startSingle());

      expect(expectOk(await service.getResumeInfo(OWNER, uploadId))).toEqual({
        status: 'OPEN',
        strategy: 'single',
      });
    });

    it('refuses a caller who does not own the upload', async () => {
      const { uploadId } = expectOk(await startMultipart());

      expect(expectErr(await service.getResumeInfo(STRANGER, uploadId)).message).toContain(
        'Not authorized'
      );
    });

    it('refuses an upload that is no longer open', async () => {
      const { uploadId } = expectOk(await startMultipart());
      expectOk(await service.abort(OWNER, uploadId));

      expect(expectErr(await service.getResumeInfo(OWNER, uploadId)).code).toBe(
        ErrorCodes.UPLOAD_NOT_OPEN
      );
    });

    it('refuses an upload whose session has expired', async () => {
      const { uploadId } = expectOk(
        await expiredService.initiate(OWNER, {
          filename: 'big.mp4',
          sizeBytes: 50 * MB,
          contentType: 'video/mp4',
        })
      );

      expect(expectErr(await service.getResumeInfo(OWNER, uploadId)).code).toBe(
        ErrorCodes.UPLOAD_EXPIRED
      );
    });
  });

  describe('issuePartUrls', () => {
    it('issues the requested window of part URLs', async () => {
      const { uploadId } = expectOk(await startMultipart());

      const parts = expectOk(await service.issuePartUrls(OWNER, uploadId, 2, 3));

      expect(parts.map((part) => part.partNumber)).toEqual([2, 3, 4]);
    });

    it('stops at the last expected part rather than inventing extras', async () => {
      const { uploadId, partsExpected = 0 } = expectOk(await startMultipart());

      const parts = expectOk(await service.issuePartUrls(OWNER, uploadId, partsExpected, 50));

      expect(parts.map((part) => part.partNumber)).toEqual([partsExpected]);
    });

    it('refuses part URLs for a single PUT upload', async () => {
      const { uploadId } = expectOk(await startSingle());

      expect(expectErr(await service.issuePartUrls(OWNER, uploadId, 1, 1)).code).toBe(
        ErrorCodes.VALIDATION_FAILED
      );
    });

    it('refuses a caller who does not own the upload', async () => {
      const { uploadId } = expectOk(await startMultipart());

      expect(expectErr(await service.issuePartUrls(STRANGER, uploadId, 1, 1)).message).toContain(
        'Not authorized'
      );
    });

    it('refuses to issue parts once the session has expired', async () => {
      const { uploadId } = expectOk(
        await expiredService.initiate(OWNER, {
          filename: 'big.mp4',
          sizeBytes: 50 * MB,
          contentType: 'video/mp4',
        })
      );

      expect(expectErr(await service.issuePartUrls(OWNER, uploadId, 1, 1)).code).toBe(
        ErrorCodes.UPLOAD_EXPIRED
      );
    });
  });
});

import {
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters';
import { ErrorCodes } from '@vp/errors';
import type { AuthUser } from '../../plugins/auth';
import { UploadService } from '../upload-service';

const OWNER: AuthUser = { id: '00000000-0000-7000-8000-00000000b001', role: 'creator' };
const STRANGER: AuthUser = { id: '00000000-0000-7000-8000-00000000b002', role: 'creator' };
const MB = 1024 * 1024;

describe('apps/api/services: upload parts', () => {
  let repositories: InMemoryRepositories;
  let service: UploadService;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    const storage = new InMemoryStorageClient();
    service = new UploadService({
      uploads: repositories.uploads,
      videos: repositories.videos,
      events: repositories.events,
      storage,
      multipart: new InMemoryMultipartStorage(storage),
      rawBucket: 'raw',
      multipartThresholdBytes: 10 * MB,
    });
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
      const { uploadId, partsExpected } = await startMultipart();

      await expect(service.getResumeInfo(OWNER, uploadId)).resolves.toMatchObject({
        status: 'OPEN',
        strategy: 'multipart',
        partsExpected,
        uploadedParts: [],
      });
    });

    it('answers a single PUT upload without consulting storage', async () => {
      const { uploadId } = await startSingle();

      await expect(service.getResumeInfo(OWNER, uploadId)).resolves.toEqual({
        status: 'OPEN',
        strategy: 'single',
      });
    });

    it('refuses a caller who does not own the upload', async () => {
      const { uploadId } = await startMultipart();

      await expect(service.getResumeInfo(STRANGER, uploadId)).rejects.toThrow('Not authorized');
    });

    it('refuses an upload that is no longer open', async () => {
      const { uploadId } = await startMultipart();
      await service.abort(OWNER, uploadId);

      await expect(service.getResumeInfo(OWNER, uploadId)).rejects.toMatchObject({
        code: ErrorCodes.UPLOAD_NOT_OPEN,
      });
    });
  });

  describe('issuePartUrls', () => {
    it('issues the requested window of part URLs', async () => {
      const { uploadId } = await startMultipart();

      const parts = await service.issuePartUrls(OWNER, uploadId, 2, 3);

      expect(parts.map((part) => part.partNumber)).toEqual([2, 3, 4]);
    });

    it('stops at the last expected part rather than inventing extras', async () => {
      const { uploadId, partsExpected = 0 } = await startMultipart();

      const parts = await service.issuePartUrls(OWNER, uploadId, partsExpected, 50);

      expect(parts.map((part) => part.partNumber)).toEqual([partsExpected]);
    });

    it('refuses part URLs for a single PUT upload', async () => {
      const { uploadId } = await startSingle();

      await expect(service.issuePartUrls(OWNER, uploadId, 1, 1)).rejects.toMatchObject({
        code: ErrorCodes.VALIDATION_FAILED,
      });
    });

    it('refuses a caller who does not own the upload', async () => {
      const { uploadId } = await startMultipart();

      await expect(service.issuePartUrls(STRANGER, uploadId, 1, 1)).rejects.toThrow(
        'Not authorized'
      );
    });
  });
});

import {
  CaslAuthorizationAdapter,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters';
import type { UploadRecord } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import type { AuthUser } from '../../plugins/auth';
import { type UploadContext, assertUploadOpen, loadOwnedUpload } from '../upload-context';

const OWNER: AuthUser = { id: '00000000-0000-7000-8000-00000000a001', role: 'CREATOR' };
const STRANGER: AuthUser = { id: '00000000-0000-7000-8000-00000000a002', role: 'CREATOR' };
const ADMIN: AuthUser = { id: '00000000-0000-7000-8000-00000000a003', role: 'ADMIN' };
const VIDEO_ID = '00000000-0000-7000-8000-00000000a004';
const UPLOAD_ID = '00000000-0000-7000-8000-00000000a005';

describe('apps/api/services: upload context', () => {
  let repositories: InMemoryRepositories;
  let ctx: UploadContext;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    const storage = new InMemoryStorageClient();
    ctx = {
      uploads: repositories.uploads,
      videos: repositories.videos,
      events: repositories.events,
      storage,
      multipart: new InMemoryMultipartStorage(storage),
      rawBucket: 'raw',
      multipartThresholdBytes: 1024,
      presignedUrlTtlSeconds: 900,
      maxInflightPerUser: 3,
      auth: new CaslAuthorizationAdapter(),
    };

    await repositories.videos.create({
      id: VIDEO_ID,
      ownerId: OWNER.id,
      title: 'Owned',
      visibility: 'private',
      status: 'UPLOADING',
      sourceKey: 'raw/owned.mp4',
    });
    await repositories.uploads.create({
      id: UPLOAD_ID,
      videoId: VIDEO_ID,
      strategy: 'single',
      status: 'OPEN',
      partSizeBytes: 1,
      partsExpected: 1,
      declaredSizeBytes: 1,
      declaredContentType: 'video/mp4',
      expiresAt: new Date(Date.now() + 60_000),
    });
  });

  describe('loadOwnedUpload', () => {
    it.each([
      ['the owner', () => OWNER],
      ['an admin', () => ADMIN],
    ])('hands %s the upload with its video', async (_label, user) => {
      const record = await loadOwnedUpload(ctx, user(), UPLOAD_ID, 'view this upload');

      expect(record.upload.id).toBe(UPLOAD_ID);
      expect(record.video.id).toBe(VIDEO_ID);
    });

    it('refuses a caller who does not own the upload', async () => {
      await expect(loadOwnedUpload(ctx, STRANGER, UPLOAD_ID, 'abort this upload')).rejects.toThrow(
        'Not authorized to abort this upload'
      );
    });

    it('reports an unknown upload as not found', async () => {
      await expect(
        loadOwnedUpload(ctx, OWNER, 'missing', 'view this upload')
      ).rejects.toMatchObject({ code: ErrorCodes.VIDEO_NOT_FOUND });
    });
  });

  describe('assertUploadOpen', () => {
    it('passes an open upload through', () => {
      expect(() => assertUploadOpen({ status: 'OPEN' } as UploadRecord)).not.toThrow();
    });

    it.each([['COMPLETED'], ['ABORTED']])('refuses a %s upload', (status) => {
      expect(() => assertUploadOpen({ status } as UploadRecord)).toThrow(
        expect.objectContaining({ code: ErrorCodes.UPLOAD_NOT_OPEN })
      );
    });
  });
});

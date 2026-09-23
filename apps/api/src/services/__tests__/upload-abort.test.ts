import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import type { UploadContext } from '../upload-context';
import { UploadService } from '../upload-service';
import { uploadContext } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000c001', role: 'CREATOR' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000c002', role: 'CREATOR' };
const MB = 1024 * 1024;

describe('apps/api/services: abort upload', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let service: UploadService;

  const build = (overrides: Partial<UploadContext> = {}) =>
    new UploadService(uploadContext(repositories, storage, overrides));

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    service = build();
  });

  const start = (sizeBytes: number) =>
    service.initiate(OWNER, { filename: 'clip.mp4', sizeBytes, contentType: 'video/mp4' });

  it.each([
    ['a single PUT upload', MB],
    ['a multipart upload', 50 * MB],
  ])('abandons the video behind %s', async (_label, sizeBytes) => {
    const { uploadId, videoId } = expectOk(await start(sizeBytes));

    expectOk(await service.abort(OWNER, uploadId));

    expect(expectOk(await repositories.videos.findById(videoId))).toMatchObject({
      status: 'ABANDONED',
    });
    expect(expectOk(await repositories.uploads.findById(uploadId))).toMatchObject({
      status: 'ABORTED',
    });
  });

  it('records the abort as a video event', async () => {
    const { uploadId, videoId } = expectOk(await start(MB));

    expectOk(await service.abort(OWNER, uploadId));

    const events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.find((event) => event.type === 'upload.aborted')?.payload).toMatchObject({
      uploadId,
      strategy: 'single',
    });
  });

  it('refuses a caller who does not own the upload', async () => {
    const { uploadId, videoId } = expectOk(await start(MB));

    expect(expectErr(await service.abort(STRANGER, uploadId)).message).toContain('Not authorized');
    expect(expectOk(await repositories.videos.findById(videoId))).toMatchObject({
      status: 'UPLOADING',
    });
  });

  it('reports an unknown upload as not found', async () => {
    expect(expectErr(await service.abort(OWNER, 'missing')).code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it('refuses a second abort of the same upload', async () => {
    const { uploadId } = expectOk(await start(MB));
    expectOk(await service.abort(OWNER, uploadId));

    expect(expectErr(await service.abort(OWNER, uploadId)).code).toBe(ErrorCodes.UPLOAD_NOT_OPEN);
  });

  it('refuses an upload whose session has expired', async () => {
    const { uploadId } = expectOk(
      await build({ uploadSessionTtlSeconds: 0 }).initiate(OWNER, {
        filename: 'clip.mp4',
        sizeBytes: MB,
        contentType: 'video/mp4',
      })
    );

    expect(expectErr(await service.abort(OWNER, uploadId)).code).toBe(ErrorCodes.UPLOAD_EXPIRED);
  });
});

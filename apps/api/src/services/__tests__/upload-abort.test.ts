import {
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters';
import { ErrorCodes } from '@vp/errors';
import type { AuthUser } from '../../plugins/auth';
import { UploadService } from '../upload-service';

const OWNER: AuthUser = { id: '00000000-0000-7000-8000-00000000c001', role: 'CREATOR' };
const STRANGER: AuthUser = { id: '00000000-0000-7000-8000-00000000c002', role: 'CREATOR' };
const MB = 1024 * 1024;

describe('apps/api/services: abort upload', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let service: UploadService;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
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

  const start = (sizeBytes: number) =>
    service.initiate(OWNER, { filename: 'clip.mp4', sizeBytes, contentType: 'video/mp4' });

  it.each([
    ['a single PUT upload', MB],
    ['a multipart upload', 50 * MB],
  ])('abandons the video behind %s', async (_label, sizeBytes) => {
    const { uploadId, videoId } = await start(sizeBytes);

    await service.abort(OWNER, uploadId);

    await expect(repositories.videos.findById(videoId)).resolves.toMatchObject({
      status: 'ABANDONED',
    });
    await expect(repositories.uploads.findById(uploadId)).resolves.toMatchObject({
      status: 'ABORTED',
    });
  });

  it('records the abort as a video event', async () => {
    const { uploadId, videoId } = await start(MB);

    await service.abort(OWNER, uploadId);

    const events = await repositories.events.findByVideoId(videoId);
    expect(events.find((event) => event.type === 'upload.aborted')?.payload).toMatchObject({
      uploadId,
      strategy: 'single',
    });
  });

  it('refuses a caller who does not own the upload', async () => {
    const { uploadId, videoId } = await start(MB);

    await expect(service.abort(STRANGER, uploadId)).rejects.toThrow('Not authorized');
    await expect(repositories.videos.findById(videoId)).resolves.toMatchObject({
      status: 'UPLOADING',
    });
  });

  it('reports an unknown upload as not found', async () => {
    await expect(service.abort(OWNER, 'missing')).rejects.toMatchObject({
      code: ErrorCodes.VIDEO_NOT_FOUND,
    });
  });
});

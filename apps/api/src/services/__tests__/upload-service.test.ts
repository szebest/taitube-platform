import {
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters';
import { MULTIPART_THRESHOLD_BYTES } from '@vp/storage';
import type { AuthUser } from '../../plugins/auth';
import { UploadService, type UploadServiceDeps } from '../upload-service';

const OWNER: AuthUser = { id: '00000000-0000-7000-8000-00000000e001', role: 'CREATOR' };

describe('apps/api/services: UploadService', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;

  function build(overrides: Partial<UploadServiceDeps> = {}): UploadService {
    return new UploadService({
      uploads: repositories.uploads,
      videos: repositories.videos,
      events: repositories.events,
      storage,
      multipart: new InMemoryMultipartStorage(storage),
      ...overrides,
    });
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
  });

  it('falls back to the packaged multipart threshold', async () => {
    const service = build();

    const result = await service.initiate(OWNER, {
      filename: 'clip.mp4',
      sizeBytes: MULTIPART_THRESHOLD_BYTES + 1,
      contentType: 'video/mp4',
    });

    expect(result.strategy).toBe('multipart');
  });

  it('stores the source under the configured raw bucket', async () => {
    const service = build({ rawBucket: 'custom-raw' });

    const { videoId } = await service.initiate(OWNER, {
      filename: 'clip.mp4',
      sizeBytes: 1024,
      contentType: 'video/mp4',
    });
    const video = await repositories.videos.findById(videoId);
    await storage.uploadObject({
      bucket: 'custom-raw',
      key: video?.sourceKey ?? '',
      body: Buffer.alloc(1024),
      contentType: 'video/mp4',
    });

    await expect(
      service.complete(OWNER, (await repositories.uploads.findByVideoId(videoId))?.id ?? '')
    ).resolves.toMatchObject({
      status: 'UPLOADED',
    });
  });

  it('dates the presigned URLs by the configured TTL', async () => {
    const service = build({ presignedUrlTtlSeconds: 60 });

    const before = Date.now();
    const { expiresAt } = await service.initiate(OWNER, {
      filename: 'clip.mp4',
      sizeBytes: 1024,
      contentType: 'video/mp4',
    });
    const after = Date.now();

    const expiry = new Date(expiresAt).getTime();
    expect(expiry).toBeGreaterThanOrEqual(before + 60_000);
    expect(expiry).toBeLessThanOrEqual(after + 60_000);
  });
});

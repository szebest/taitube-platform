import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import type { UserContext } from '@vp/permissions';
import { MULTIPART_THRESHOLD_BYTES } from '@vp/storage';
import { expectOk } from '@vp/testing/result';
import type { UploadContext } from '../upload-context';
import { UploadService } from '../upload-service';
import { uploadContext } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000e001', role: 'CREATOR' };

describe('apps/api/services: UploadService', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;

  function build(overrides: Partial<UploadContext> = {}): UploadService {
    return new UploadService(
      uploadContext(repositories, storage, {
        multipartThresholdBytes: MULTIPART_THRESHOLD_BYTES,
        ...overrides,
      })
    );
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
  });

  it('switches to multipart above the configured threshold', async () => {
    const service = build();

    const result = expectOk(
      await service.initiate(OWNER, {
        filename: 'clip.mp4',
        sizeBytes: MULTIPART_THRESHOLD_BYTES + 1,
        contentType: 'video/mp4',
      })
    );

    expect(result.strategy).toBe('multipart');
  });

  it('stores the source under the configured raw bucket', async () => {
    const service = build({ rawBucket: 'custom-raw' });

    const { videoId } = expectOk(
      await service.initiate(OWNER, {
        filename: 'clip.mp4',
        sizeBytes: 1024,
        contentType: 'video/mp4',
      })
    );
    const video = expectOk(await repositories.videos.findById(videoId));
    await storage.uploadObject({
      bucket: 'custom-raw',
      key: video?.sourceKey ?? '',
      body: Buffer.alloc(1024),
      contentType: 'video/mp4',
    });

    const completed = await service.complete(
      OWNER,
      expectOk(await repositories.uploads.findByVideoId(videoId))?.id ?? ''
    );

    expect(expectOk(completed)).toMatchObject({ status: 'UPLOADED' });
  });

  it('dates the presigned URLs by the configured TTL', async () => {
    const service = build({ presignedUrlTtlSeconds: 60 });

    const before = Date.now();
    const { expiresAt } = expectOk(
      await service.initiate(OWNER, {
        filename: 'clip.mp4',
        sizeBytes: 1024,
        contentType: 'video/mp4',
      })
    );
    const after = Date.now();

    const expiry = new Date(expiresAt).getTime();
    expect(expiry).toBeGreaterThanOrEqual(before + 60_000);
    expect(expiry).toBeLessThanOrEqual(after + 60_000);
  });
});

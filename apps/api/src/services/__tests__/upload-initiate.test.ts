import {
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { UploadService } from '../upload-service';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-000000000001', role: 'CREATOR' };
const MB = 1024 * 1024;

describe('apps/api/services: initiate upload', () => {
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
      presignedUrlTtlSeconds: 900,
      maxInflightPerUser: 3,
    });
  });

  it('issues a single presigned PUT below the multipart threshold', async () => {
    const result = expectOk(
      await service.initiate(OWNER, {
        filename: 'sample.mp4',
        sizeBytes: 5 * MB,
        contentType: 'video/mp4',
        title: 'Service Direct Test',
      })
    );

    expect(result).toMatchObject({ strategy: 'single' });
    expect(result.singleUrl).toBeDefined();
    expect(result.parts).toBeUndefined();
    expect(expectOk(await repositories.videos.findById(result.videoId))).toMatchObject({
      ownerId: OWNER.id,
      title: 'Service Direct Test',
      status: 'UPLOADING',
    });
  });

  it.each([
    ['above the threshold', 20 * MB, undefined, 'multipart'],
    ['below the threshold', 1 * MB, undefined, 'single'],
    ['forced to multipart', 1 * MB, 'multipart', 'multipart'],
    ['forced to single', 20 * MB, 'single', 'single'],
  ] as const)('picks %s -> %s', async (_label, sizeBytes, strategy, expected) => {
    const result = expectOk(
      await service.initiate(OWNER, {
        filename: 'sample.mp4',
        sizeBytes,
        contentType: 'video/mp4',
        ...(strategy ? { strategy } : {}),
      })
    );

    expect(result.strategy).toBe(expected);
  });

  it('hands back the first batch of part URLs for a multipart upload', async () => {
    const result = expectOk(
      await service.initiate(OWNER, {
        filename: 'big.mp4',
        sizeBytes: 50 * MB,
        contentType: 'video/mp4',
      })
    );

    expect(result.parts?.length).toBe(result.partsExpected);
    expect(result.parts?.[0]?.partNumber).toBe(1);
  });

  it.each([
    ['defaults to private', undefined, 'private'],
    ['honours the requested visibility', 'public', 'public'],
  ] as const)('%s', async (_label, visibility, expected) => {
    const result = expectOk(
      await service.initiate(OWNER, {
        filename: 'sample.mp4',
        sizeBytes: MB,
        contentType: 'video/mp4',
        ...(visibility ? { visibility } : {}),
      })
    );

    expect(expectOk(await repositories.videos.findById(result.videoId))).toMatchObject({
      visibility: expected,
    });
  });

  it('titles the video after the filename when no title is given', async () => {
    const result = expectOk(
      await service.initiate(OWNER, {
        filename: 'holiday.mov',
        sizeBytes: MB,
        contentType: 'video/quicktime',
      })
    );

    expect(expectOk(await repositories.videos.findById(result.videoId))).toMatchObject({
      title: 'holiday.mov',
      sourceKey: expect.stringContaining('.mov'),
    });
  });

  it('records the initiation as a video event', async () => {
    const result = expectOk(
      await service.initiate(OWNER, {
        filename: 'sample.mp4',
        sizeBytes: MB,
        contentType: 'video/mp4',
      })
    );

    const events = expectOk(await repositories.events.findByVideoId(result.videoId));
    expect(events.find((event) => event.type === 'upload.initiated')?.payload).toMatchObject({
      uploadId: result.uploadId,
      strategy: 'single',
    });
  });
});

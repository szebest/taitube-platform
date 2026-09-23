import {
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters';
import { ErrorCodes } from '@vp/errors';
import { ids } from '@vp/job-contracts';
import { expectErr, expectOk } from '@vp/testing/result';
import type { AuthUser } from '../../plugins/auth';
import { UploadService } from '../upload-service';

const OWNER: AuthUser = { id: '00000000-0000-7000-8000-00000000d001', role: 'CREATOR' };
const STRANGER: AuthUser = { id: '00000000-0000-7000-8000-00000000d002', role: 'CREATOR' };
const MB = 1024 * 1024;
const SIZE = 3;

describe('apps/api/services: complete upload', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let probeQueue: InMemoryJobQueue;
  let service: UploadService;

  function build(maxInflightPerUser = 3, uploadSessionTtlSeconds?: number): UploadService {
    return new UploadService({
      uploads: repositories.uploads,
      videos: repositories.videos,
      events: repositories.events,
      users: repositories.users,
      storage,
      multipart: new InMemoryMultipartStorage(storage),
      rawBucket: 'raw',
      probeQueue,
      multipartThresholdBytes: 10 * MB,
      maxInflightPerUser,
      ...(uploadSessionTtlSeconds === undefined ? {} : { uploadSessionTtlSeconds }),
    });
  }

  async function startSingle(sizeBytes = SIZE) {
    const started = expectOk(
      await service.initiate(OWNER, {
        filename: 'clip.mp4',
        sizeBytes,
        contentType: 'video/mp4',
      })
    );
    const video = expectOk(await repositories.videos.findById(started.videoId));
    return { ...started, sourceKey: video?.sourceKey ?? '' };
  }

  const store = (key: string, bytes: number) =>
    storage.uploadObject({
      bucket: 'raw',
      key,
      body: Buffer.alloc(bytes),
      contentType: 'video/mp4',
    });

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    probeQueue = new InMemoryJobQueue('probe');
    service = build();
  });

  it('marks the video UPLOADED and enqueues the first-generation probe', async () => {
    const started = await startSingle();
    await store(started.sourceKey, SIZE);

    const result = expectOk(await service.complete(OWNER, started.uploadId));

    expect(result).toEqual({
      videoId: started.videoId,
      status: 'UPLOADED',
      admission: 'admitted',
    });
    const jobs = expectOk(await probeQueue.getJobs(['waiting', 'delayed', 'active']));
    expect(jobs[0]?.opts?.jobId).toBe(ids.probe(started.videoId, 1));
  });

  it('holds the probe once the owner is at their in-flight limit', async () => {
    service = build(0);
    const started = await startSingle();
    await store(started.sourceKey, SIZE);

    expect(expectOk(await service.complete(OWNER, started.uploadId))).toMatchObject({
      admission: 'held',
    });
    expect(expectOk(await probeQueue.getJobs(['waiting', 'delayed', 'active']))).toHaveLength(0);
  });

  it('is idempotent once the video has moved past UPLOADING', async () => {
    const started = await startSingle();
    await store(started.sourceKey, SIZE);
    expectOk(await service.complete(OWNER, started.uploadId));

    expect(expectOk(await service.complete(OWNER, started.uploadId))).toEqual({
      videoId: started.videoId,
      status: 'UPLOADED',
    });
  });

  it('reports a missing object as SOURCE_MISSING', async () => {
    const started = await startSingle();

    expect(expectErr(await service.complete(OWNER, started.uploadId)).code).toBe(
      ErrorCodes.SOURCE_MISSING
    );
  });

  it('rejects and deletes an object whose size disagrees with the declaration', async () => {
    const started = await startSingle();
    await store(started.sourceKey, SIZE + 10);

    expect(expectErr(await service.complete(OWNER, started.uploadId)).code).toBe(
      ErrorCodes.UPLOAD_SIZE_MISMATCH
    );
    expect(expectOk(await repositories.videos.findById(started.videoId))).toMatchObject({
      status: 'REJECTED',
      errorCode: ErrorCodes.UPLOAD_SIZE_MISMATCH,
    });
    expect(expectOk(await storage.headObject('raw', started.sourceKey))).toBeNull();
  });

  it('refuses a caller who does not own the upload', async () => {
    const started = await startSingle();

    expect(expectErr(await service.complete(STRANGER, started.uploadId)).message).toContain(
      'Not authorized'
    );
  });

  it('refuses to complete an upload that was aborted', async () => {
    const started = await startSingle();
    await repositories.uploads.updateStatus(started.uploadId, 'ABORTED');

    expect(expectErr(await service.complete(OWNER, started.uploadId)).code).toBe(
      ErrorCodes.UPLOAD_NOT_OPEN
    );
  });

  it('refuses to complete an upload whose session has expired', async () => {
    const expired = build(3, 0);
    const started = expectOk(
      await expired.initiate(OWNER, {
        filename: 'clip.mp4',
        sizeBytes: SIZE,
        contentType: 'video/mp4',
      })
    );
    const video = expectOk(await repositories.videos.findById(started.videoId));
    await store(video?.sourceKey ?? '', SIZE);

    expect(expectErr(await service.complete(OWNER, started.uploadId)).code).toBe(
      ErrorCodes.UPLOAD_EXPIRED
    );
  });

  it.each([
    ['no parts at all', undefined],
    ['fewer parts than expected', [{ partNumber: 1, etag: 'a' }]],
  ])('refuses a multipart completion with %s', async (_label, parts) => {
    const started = expectOk(
      await service.initiate(OWNER, {
        filename: 'big.mp4',
        sizeBytes: 50 * MB,
        contentType: 'video/mp4',
      })
    );

    expect(expectErr(await service.complete(OWNER, started.uploadId, parts)).code).toBe(
      ErrorCodes.VALIDATION_FAILED
    );
  });
});

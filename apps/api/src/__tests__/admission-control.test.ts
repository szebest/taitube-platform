import {
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { composeApp } from '../app';
import { completeUpload, postUpload } from './upload-requests';
import { SEEDED } from '@vp/testing';

describe('upload admission control and tier priorities', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let multipart: InMemoryMultipartStorage;
  let probeQueue: InMemoryJobQueue;

  const FREE_USER_ID = '00000000-0000-7000-8000-000000000002';
  const PRO_USER_ID = SEEDED.userId;

  let freeToken: string;
  let proToken: string;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    multipart = new InMemoryMultipartStorage();
    probeQueue = new InMemoryJobQueue('probe');

    app = (
      await composeApp({
        adapters: {
          repositories,
          storage,
          multipart,
          probeQueue,
        },
        config: inProcessAppConfig({ limits: { maxInflightPerUser: 3 } }),
      })
    ).app;
    await app.ready();

    freeToken = mintToken({ sub: FREE_USER_ID, role: 'user' });
    proToken = mintToken({ sub: PRO_USER_ID, role: 'user' });
  });

  afterEach(async () => {
    await app.close();
  });

  async function createAndCompleteUpload(token: string, filename: string) {
    const initRes = await postUpload(app, token, { filename, sizeBytes: 1024 });
    expect(initRes.statusCode).toBe(201);
    const { videoId, uploadId } = initRes.json();
    const video = expectOk(await repositories.videos.findById(videoId));
    if (!video) {
      throw new Error('Video not found');
    }

    await storage.uploadObject({
      bucket: 'raw',
      key: video.sourceKey,
      body: Buffer.alloc(1024),
      contentType: 'video/mp4',
    });

    const completeRes = await completeUpload(app, token, uploadId);

    return { initRes, completeRes, videoId, uploadId };
  }

  it.each([
    { tier: 'free', token: () => freeToken, filename: 'video1.mp4', priority: 5 },
    { tier: 'pro', token: () => proToken, filename: 'pro-video.mp4', priority: 1 },
  ])(
    'admits a $tier user under the limit and enqueues the probe at priority $priority',
    async ({ token, filename, priority }) => {
      const { completeRes, videoId } = await createAndCompleteUpload(token(), filename);

      expect(completeRes.statusCode).toBe(202);
      expect(completeRes.json()).toEqual({ videoId, status: 'UPLOADED', admission: 'admitted' });

      const jobs = expectOk(await probeQueue.getJobs(['waiting', 'prioritized']));
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.data).toMatchObject({ videoId });
      expect(jobs[0]?.opts?.priority).toBe(priority);
    }
  );

  it('holds the 4th complete past maxInflightPerUser=3 without a probe job, and still admits another user', async () => {
    const v1 = await createAndCompleteUpload(freeToken, 'v1.mp4');
    const v2 = await createAndCompleteUpload(freeToken, 'v2.mp4');
    const v3 = await createAndCompleteUpload(freeToken, 'v3.mp4');

    expect(v1.completeRes.json().admission).toBe('admitted');
    expect(v2.completeRes.json().admission).toBe('admitted');
    expect(v3.completeRes.json().admission).toBe('admitted');

    await repositories.videos.transition({
      videoId: v1.videoId,
      from: 'UPLOADED',
      to: 'PROBING',
      eventType: 'probe.started',
    });
    await repositories.videos.transition({
      videoId: v2.videoId,
      from: 'UPLOADED',
      to: 'PROCESSING',
      eventType: 'transcode.started',
    });
    await repositories.videos.transition({
      videoId: v3.videoId,
      from: 'UPLOADED',
      to: 'PROBING',
      eventType: 'probe.started',
    });

    const inflight = expectOk(await repositories.videos.countInFlightByOwner(FREE_USER_ID));
    expect(inflight).toBe(3);

    const initialJobs = expectOk(await probeQueue.getJobs(['waiting', 'prioritized']));
    expect(initialJobs).toHaveLength(3);

    const v4 = await createAndCompleteUpload(freeToken, 'v4.mp4');

    expect(v4.completeRes.statusCode).toBe(202);
    expect(v4.completeRes.json()).toEqual({
      videoId: v4.videoId,
      status: 'UPLOADED',
      admission: 'held',
    });

    const v4Db = expectOk(await repositories.videos.findById(v4.videoId));
    expect(v4Db?.status).toBe('UPLOADED');

    const afterJobs = expectOk(await probeQueue.getJobs(['waiting', 'prioritized']));
    expect(afterJobs).toHaveLength(3);
    expect(
      afterJobs.find((j) => (j.data as { videoId: string }).videoId === v4.videoId)
    ).toBeUndefined();

    const proVid = await createAndCompleteUpload(proToken, 'pro.mp4');
    expect(proVid.completeRes.statusCode).toBe(202);
    expect(proVid.completeRes.json().admission).toBe('admitted');

    const totalJobs = expectOk(await probeQueue.getJobs(['waiting', 'prioritized']));
    expect(totalJobs).toHaveLength(4);
    const proJob = totalJobs.find(
      (j) => (j.data as { videoId: string }).videoId === proVid.videoId
    );
    expect(proJob).toBeDefined();
    expect(proJob?.opts?.priority).toBe(1);
  });
});

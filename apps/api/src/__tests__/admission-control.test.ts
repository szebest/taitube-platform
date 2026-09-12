import {
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters';
import { mintDevToken } from '@vp/dev-token';
import type { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('apps/api Admission Control and Tier Priorities (Ticket 18: AC 1, AC 3)', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let multipart: InMemoryMultipartStorage;
  let probeQueue: InMemoryJobQueue;

  const FREE_USER_ID = '00000000-0000-7000-8000-000000000002'; // user@video-pipeline.local (tier: free)
  const PRO_USER_ID = '00000000-0000-7000-8000-000000000001'; // dev@video-pipeline.local (tier: pro)

  let freeToken: string;
  let proToken: string;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    multipart = new InMemoryMultipartStorage();
    probeQueue = new InMemoryJobQueue('probe');

    app = await buildApp({
      repositories,
      storage,
      multipart,
      jobQueue: probeQueue,
      maxInflightPerUser: 3,
    });
    await app.ready();

    freeToken = mintDevToken({ sub: FREE_USER_ID, role: 'user' });
    proToken = mintDevToken({ sub: PRO_USER_ID, role: 'user' });
  });

  async function createAndCompleteUpload(token: string, filename: string) {
    const initRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        filename,
        sizeBytes: 1024,
        contentType: 'video/mp4',
      },
    });
    expect(initRes.statusCode).toBe(201);
    const { videoId, uploadId } = initRes.json();
    const video = await repositories.videos.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    // Upload raw bytes to storage double
    await storage.uploadObject({
      bucket: 'raw',
      key: video.sourceKey,
      body: Buffer.alloc(1024),
      contentType: 'video/mp4',
    });

    const completeRes = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${uploadId}/complete`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    return { initRes, completeRes, videoId, uploadId };
  }

  it('AC 1: Free user completing uploads under limit gets admission: admitted and probe job with priority 5', async () => {
    const { completeRes, videoId } = await createAndCompleteUpload(freeToken, 'video1.mp4');

    expect(completeRes.statusCode).toBe(202);
    expect(completeRes.json()).toEqual({
      videoId,
      status: 'UPLOADED',
      admission: 'admitted',
    });

    // Probe job is enqueued with priority 5
    const jobs = await probeQueue.getJobs(['waiting', 'prioritized']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.data).toMatchObject({ videoId });
    expect(jobs[0]?.opts?.priority).toBe(5);
  });

  it('AC 1: Pro user completing uploads gets admission: admitted and probe job with priority 1', async () => {
    const { completeRes, videoId } = await createAndCompleteUpload(proToken, 'pro-video.mp4');

    expect(completeRes.statusCode).toBe(202);
    expect(completeRes.json()).toEqual({
      videoId,
      status: 'UPLOADED',
      admission: 'admitted',
    });

    const jobs = await probeQueue.getJobs(['waiting', 'prioritized']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.data).toMatchObject({ videoId });
    expect(jobs[0]?.opts?.priority).toBe(1);
  });

  it('AC 1: With MAX_INFLIGHT_PER_USER=3, the 4th complete returns admission: held and enqueues NO probe job', async () => {
    // Complete 3 videos for free user
    const v1 = await createAndCompleteUpload(freeToken, 'v1.mp4');
    const v2 = await createAndCompleteUpload(freeToken, 'v2.mp4');
    const v3 = await createAndCompleteUpload(freeToken, 'v3.mp4');

    expect(v1.completeRes.json().admission).toBe('admitted');
    expect(v2.completeRes.json().admission).toBe('admitted');
    expect(v3.completeRes.json().admission).toBe('admitted');

    // Simulate videos 1, 2, 3 actively probing/processing
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

    // Verify active in-flight count is 3
    const inflight = await repositories.videos.countInFlightByOwner(FREE_USER_ID);
    expect(inflight).toBe(3);

    // Initial probe jobs count is 3
    const initialJobs = await probeQueue.getJobs(['waiting', 'prioritized']);
    expect(initialJobs).toHaveLength(3);

    // 4th complete by the same user
    const v4 = await createAndCompleteUpload(freeToken, 'v4.mp4');

    // Returns 202 with status: UPLOADED, admission: held
    expect(v4.completeRes.statusCode).toBe(202);
    expect(v4.completeRes.json()).toEqual({
      videoId: v4.videoId,
      status: 'UPLOADED',
      admission: 'held',
    });

    // Video 4 in DB is UPLOADED
    const v4Db = await repositories.videos.findById(v4.videoId);
    expect(v4Db?.status).toBe('UPLOADED');

    // No new probe job enqueued for v4!
    const afterJobs = await probeQueue.getJobs(['waiting', 'prioritized']);
    expect(afterJobs).toHaveLength(3);
    expect(
      afterJobs.find((j) => (j.data as { videoId: string }).videoId === v4.videoId)
    ).toBeUndefined();

    // Another user (pro) can still upload and get admitted because their in-flight count is 0
    const proVid = await createAndCompleteUpload(proToken, 'pro.mp4');
    expect(proVid.completeRes.statusCode).toBe(202);
    expect(proVid.completeRes.json().admission).toBe('admitted');

    const totalJobs = await probeQueue.getJobs(['waiting', 'prioritized']);
    expect(totalJobs).toHaveLength(4);
    const proJob = totalJobs.find(
      (j) => (j.data as { videoId: string }).videoId === proVid.videoId
    );
    expect(proJob).toBeDefined();
    expect(proJob?.opts?.priority).toBe(1);
  });
});

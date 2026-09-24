import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes, queueUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { type FakeS3, startFakeS3 } from './fake-s3';
import { buildInMemoryApp } from './in-memory-app';
import { MockProbeJobQueue } from './mock-probe-queue';
import { completeUpload, postUpload, putObject } from './upload-requests';
import { SEEDED } from '@vp/testing';

const DEV_USER_ID = SEEDED.userId;

describe('apps/api completing a single-part upload', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let s3: FakeS3;
  const probeQueue = new MockProbeJobQueue();
  const probeJobs = probeQueue.jobs;
  const authToken = mintToken({ sub: DEV_USER_ID, role: 'user', ttl: '1h' });

  async function uploadBytes(filename: string, size: number) {
    const created = await postUpload(app, authToken, { filename, sizeBytes: size });
    expect(created.statusCode).toBe(201);
    const { videoId, uploadId, singleUrl } = created.json();
    expect((await putObject(singleUrl, size)).status).toBe(200);
    return { videoId, uploadId };
  }

  beforeAll(async () => {
    s3 = await startFakeS3();
    ({ app, repositories } = await buildInMemoryApp({
      adapters: { storage: s3.storage, multipart: s3.multipart, probeQueue },
    }));
  });

  afterAll(async () => {
    await app.close();
    await s3.close();
  });

  it('commits UPLOADED, appends upload.completed and enqueues {videoId}--probe--g1 exactly once', async () => {
    const { videoId, uploadId } = await uploadBytes('complete-test.mp4', 100);

    const completeRes = await completeUpload(app, authToken, uploadId);

    expect(completeRes.statusCode).toBe(202);
    expect(completeRes.json()).toEqual({ videoId, status: 'UPLOADED', admission: 'admitted' });
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('UPLOADED');
    const events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.some((e) => e.type === 'upload.completed')).toBe(true);
    const enqueuedJob = probeJobs.find((j) => j.opts?.jobId === `${videoId}--probe--g1`);
    expect(enqueuedJob).toBeDefined();
    expect(enqueuedJob?.name).toBe('probe');
    expect(enqueuedJob?.data['videoId']).toBe(videoId);
    expect(enqueuedJob?.data['generation']).toBe(1);

    const initialJobCount = probeJobs.length;
    const secondComplete = await completeUpload(app, authToken, uploadId);

    expect(secondComplete.statusCode).toBe(202);
    expect(secondComplete.json().status).toBe('UPLOADED');
    expect(probeJobs.length).toBe(initialJobCount);
  });

  it('size mismatch at complete -> 422 UPLOAD_SIZE_MISMATCH, object deleted, video REJECTED', async () => {
    const declaredSize = 200;
    const actualSize = 150;
    const createRes = await postUpload(app, authToken, {
      filename: 'mismatch.mp4',
      sizeBytes: declaredSize,
    });
    expect(createRes.statusCode).toBe(201);
    const { videoId, uploadId } = createRes.json();
    const sourceKey = `raw/${videoId}/source.mp4`;
    s3.objects.set(sourceKey, { size: actualSize, contentType: 'video/mp4' });

    const completeRes = await completeUpload(app, authToken, uploadId);

    expect(completeRes.statusCode).toBe(422);
    expect(completeRes.headers['content-type']).toContain('application/problem+json');
    const problem = completeRes.json();
    expect(problem.code).toBe(ErrorCodes.UPLOAD_SIZE_MISMATCH);
    expect(s3.objects.has(sourceKey)).toBe(false);
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('REJECTED');
    expect(video?.errorCode).toBe(ErrorCodes.UPLOAD_SIZE_MISMATCH);
  });

  it('keeps the commit when the direct enqueue fails after it, and the outbox relay publishes the probe job', async () => {
    const { videoId, uploadId } = await uploadBytes('crash-test.mp4', 100);
    const initialProbeCount = probeJobs.length;
    vi.spyOn(probeQueue, 'add').mockResolvedValueOnce(err(queueUnavailable('probe.add')));

    const completed = await completeUpload(app, authToken, uploadId);

    expect(completed.statusCode).toBe(202);
    expect(completed.json()).toMatchObject({ videoId, status: 'UPLOADED' });
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('UPLOADED');
    expect(probeJobs.length).toBe(initialProbeCount);

    const pendingOutbox = expectOk(await repositories.outbox.claimBatch(10));
    const probeOutboxItem = pendingOutbox.find(
      (item) =>
        item.kind === 'probe' &&
        item.payload.type === 'queue' &&
        (item.payload.job.data as { videoId?: string }).videoId === videoId
    );
    expect(probeOutboxItem).toBeDefined();

    for (const item of pendingOutbox) {
      if (item.payload.type !== 'queue') continue;
      await probeQueue.add(item.payload.job.name, item.payload.job.data, item.payload.job.opts);
      await repositories.outbox.markPublished(item.id);
    }

    const relayedJob = probeJobs.find((j) => j.opts?.jobId === `${videoId}--probe--g1`);
    expect(relayedJob).toBeDefined();
    expect(relayedJob?.data['videoId']).toBe(videoId);
  });
});

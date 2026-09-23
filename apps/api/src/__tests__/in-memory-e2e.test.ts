import {
  InMemoryCacheClient,
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('Pure In-Memory E2E Video Pipeline (Zero External Sockets)', () => {
  let app: FastifyInstance;
  const repositories = new InMemoryRepositories();
  const storage = new InMemoryStorageClient();
  const multipart = new InMemoryMultipartStorage(storage);
  const cache = new InMemoryCacheClient();
  const probeQueue = new InMemoryJobQueue('probe');

  const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
  let authToken: string;

  beforeAll(async () => {
    authToken = mintToken({
      sub: DEV_USER_ID,
      role: 'user',
      ttl: '2h',
    });

    const adminQueues = new Map();
    adminQueues.set('probe', probeQueue);

    app = await buildApp({
      adapters: {
        repositories,
        storage,
        multipart,
        cache,
        probeQueue,
        queues: adminQueues,
      },
      config: inProcessAppConfig({
        buckets: { raw: 'raw-bucket' },
        limits: { multipartThresholdBytes: 5 * 1024 * 1024 },
      }),
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Health check verifies all in-memory ports report healthy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/readyz',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.checks.postgres).toBe('ok');
    expect(body.checks.redis).toBe('ok');
    expect(body.checks.s3).toBe('ok');
  });

  it('2. Single PUT upload full lifecycle (pure in-memory)', async () => {
    const size = 1024 * 1024; // 1 MB
    const initRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        filename: 'sample.mp4',
        sizeBytes: size,
        contentType: 'video/mp4',
        title: 'Single Upload Test',
      },
    });

    expect(initRes.statusCode).toBe(201);
    const initData = JSON.parse(initRes.body);
    expect(initData.strategy).toBe('single');
    expect(initData.videoId).toBeDefined();
    expect(initData.uploadId).toBeDefined();
    expect(initData.singleUrl).toBeDefined();

    // Verify DB state
    const videoBefore = expectOk(await repositories.videos.findById(initData.videoId));
    expect(videoBefore?.status).toBe('UPLOADING');
    expect(videoBefore?.title).toBe('Single Upload Test');

    // Simulate S3 upload directly to in-memory storage client
    const sourceKey = videoBefore?.sourceKey ?? '';
    await storage.uploadObject({
      bucket: 'raw-bucket',
      key: sourceKey,
      body: Buffer.alloc(size, 0x55),
      contentType: 'video/mp4',
    });

    // Complete upload
    const completeRes = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${initData.uploadId}/complete`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {},
    });

    expect(completeRes.statusCode).toBe(202);
    const completeData = JSON.parse(completeRes.body);
    expect(completeData.status).toBe('UPLOADED');

    // Verify video transitioned to UPLOADED in DB
    const videoAfter = expectOk(await repositories.videos.findById(initData.videoId));
    expect(videoAfter?.status).toBe('UPLOADED');

    // Verify probe job was enqueued in InMemoryJobQueue
    const jobs = expectOk(await probeQueue.getJobs());
    expect(jobs.length).toBeGreaterThanOrEqual(1);
    const probeJob = jobs.find(
      (j) => (j.data as Record<string, unknown>)?.['videoId'] === initData.videoId
    );
    expect(probeJob).toBeDefined();
    expect((probeJob?.data as Record<string, unknown>)?.['sourceKey']).toBe(sourceKey);

    // Verify video can be queried via Video API
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/videos/${initData.videoId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(getRes.statusCode).toBe(200);
    const videoBody = JSON.parse(getRes.body);
    expect(videoBody.id).toBe(initData.videoId);
    expect(videoBody.status).toBe('UPLOADED');
  });

  it('3. Multipart upload full lifecycle with resume and completion (pure in-memory)', async () => {
    const partSize = 5 * 1024 * 1024;
    const totalSize = 2 * partSize; // 10 MB = 2 parts

    const initRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        filename: 'multipart-sample.mp4',
        sizeBytes: totalSize,
        contentType: 'video/mp4',
      },
    });

    expect(initRes.statusCode).toBe(201);
    const initData = JSON.parse(initRes.body);
    expect(initData.strategy).toBe('multipart');
    expect(initData.partsExpected).toBe(2);
    expect(initData.parts.length).toBe(2);

    const uploadRecord = expectOk(await repositories.uploads.findById(initData.uploadId));
    expect(uploadRecord?.multipartUploadId).toBeDefined();
    const s3MultipartUploadId = uploadRecord?.multipartUploadId ?? '';

    // Client uploads part 1 to in-memory multipart storage
    multipart.seedPart(s3MultipartUploadId, 1, Buffer.alloc(partSize, 0x11));

    // Check resume info
    const resumeRes = await app.inject({
      method: 'GET',
      url: `/v1/uploads/${initData.uploadId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(resumeRes.statusCode).toBe(200);
    const resumeData = JSON.parse(resumeRes.body);
    expect(resumeData.uploadedParts.length).toBe(1);
    expect(resumeData.uploadedParts[0].partNumber).toBe(1);

    // Client uploads part 2
    multipart.seedPart(s3MultipartUploadId, 2, Buffer.alloc(partSize, 0x22));

    // Complete upload
    const completeRes = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${initData.uploadId}/complete`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        parts: [
          { partNumber: 1, etag: 'etag-part-1' },
          { partNumber: 2, etag: 'etag-part-2' },
        ],
      },
    });

    expect(completeRes.statusCode).toBe(202);
    const video = expectOk(await repositories.videos.findById(initData.videoId));
    expect(video?.status).toBe('UPLOADED');
  });
});

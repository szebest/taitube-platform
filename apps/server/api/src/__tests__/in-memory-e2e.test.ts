import {
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  type InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp } from './test-app';

describe('Pure In-Memory E2E Video Pipeline (Zero External Sockets)', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  const storage = new InMemoryStorageClient();
  const multipart = new InMemoryMultipartStorage(storage);
  const probeQueue = new InMemoryJobQueue('probe');

  const auth = bearer(TOKENS.user);

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp({
      config: inProcessAppConfig({
        buckets: { raw: 'raw-bucket' },
        limits: { multipartThresholdBytes: 5 * 1024 * 1024 },
      }),
      adapters: { storage, multipart, probeQueue },
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('carries a single PUT upload from start to a queued probe', async () => {
    const size = 1024 * 1024;
    const initRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: auth,
      payload: {
        filename: 'sample.mp4',
        sizeBytes: size,
        contentType: 'video/mp4',
        title: 'Single Upload Test',
      },
    });

    expect(initRes.statusCode).toBe(201);
    const initData = initRes.json();
    expect(initData.strategy).toBe('single');
    expect(initData.videoId).toBeDefined();
    expect(initData.uploadId).toBeDefined();
    expect(initData.singleUrl).toBeDefined();

    const videoBefore = expectOk(await repositories.videos.findById(initData.videoId));
    expect(videoBefore?.status).toBe('UPLOADING');
    expect(videoBefore?.title).toBe('Single Upload Test');

    const sourceKey = videoBefore?.sourceKey ?? '';
    await storage.uploadObject({
      bucket: 'raw-bucket',
      key: sourceKey,
      body: Buffer.alloc(size, 0x55),
      contentType: 'video/mp4',
    });

    const completeRes = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${initData.uploadId}/complete`,
      headers: auth,
      payload: {},
    });

    expect(completeRes.statusCode).toBe(202);
    const completeData = completeRes.json();
    expect(completeData.status).toBe('UPLOADED');

    const videoAfter = expectOk(await repositories.videos.findById(initData.videoId));
    expect(videoAfter?.status).toBe('UPLOADED');

    const jobs = expectOk(await probeQueue.getJobs());
    expect(jobs.length).toBeGreaterThanOrEqual(1);
    expect(jobs).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({ videoId: initData.videoId, sourceKey }),
      })
    );

    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/videos/${initData.videoId}`,
      headers: auth,
    });
    expect(getRes.statusCode).toBe(200);
    const videoBody = getRes.json();
    expect(videoBody.id).toBe(initData.videoId);
    expect(videoBody.status).toBe('UPLOADED');
  });

  it('carries a multipart upload through a resume to completion', async () => {
    const partSize = 5 * 1024 * 1024;
    const totalSize = 2 * partSize;

    const initRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: auth,
      payload: {
        filename: 'multipart-sample.mp4',
        sizeBytes: totalSize,
        contentType: 'video/mp4',
      },
    });

    expect(initRes.statusCode).toBe(201);
    const initData = initRes.json();
    expect(initData.strategy).toBe('multipart');
    expect(initData.partsExpected).toBe(2);
    expect(initData.parts.length).toBe(2);

    const uploadRecord = expectOk(await repositories.uploads.findById(initData.uploadId));
    expect(uploadRecord?.multipartUploadId).toBeDefined();
    const s3MultipartUploadId = uploadRecord?.multipartUploadId ?? '';

    multipart.seedPart(s3MultipartUploadId, 1, Buffer.alloc(partSize, 0x11));

    const resumeRes = await app.inject({
      method: 'GET',
      url: `/v1/uploads/${initData.uploadId}`,
      headers: auth,
    });
    expect(resumeRes.statusCode).toBe(200);
    const resumeData = resumeRes.json();
    expect(resumeData.uploadedParts.length).toBe(1);
    expect(resumeData.uploadedParts[0].partNumber).toBe(1);

    multipart.seedPart(s3MultipartUploadId, 2, Buffer.alloc(partSize, 0x22));

    const completeRes = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${initData.uploadId}/complete`,
      headers: auth,
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

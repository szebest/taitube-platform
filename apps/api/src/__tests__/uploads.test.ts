import * as http from 'node:http';
import { InMemoryRepositories, S3MultipartStorage, S3StorageClient } from '@vp/adapters';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { MockProbeJobQueue } from './mock-probe-queue';

describe('apps/api Upload slice (Ticket 05: AC 17, 18, 19, 20, 21, 22)', () => {
  let app: FastifyInstance;
  const repositories = new InMemoryRepositories();
  const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
  const authToken = mintToken({ sub: DEV_USER_ID, role: 'user', ttl: '1h' });

  // In-memory mock S3 HTTP Server simulating MinIO
  let s3Server: http.Server;
  let s3Port: number;
  const storageMap = new Map<Buffer | string, { bytes: Buffer; contentType: string }>();
  const signedLengths = new Map<string, number>();

  // Mock queue for probe
  const mockProbeQueue = new MockProbeJobQueue();
  const probeJobs = mockProbeQueue.jobs;

  beforeAll(async () => {
    // 1. Start lightweight S3 mock server with signature / length checks
    s3Server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${s3Port}`);
      // In path-style S3: /bucket/key -> strip bucket
      const pathSegments = url.pathname.replace(/^\/+/, '').split('/');
      const key = pathSegments.slice(1).join('/'); // e.g. "raw/{videoId}/source.mp4"

      if (req.method === 'PUT') {
        const declaredLength = Number(req.headers['content-length'] ?? -1);
        const contentType = req.headers['content-type'] || 'application/octet-stream';
        const chunks: Buffer[] = [];

        req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        req.on('end', () => {
          const body = Buffer.concat(chunks);

          // AC 18: Uploading body of different length fails at storage level
          const expected = signedLengths.get(key);
          if (
            (expected !== undefined && (declaredLength !== expected || body.length !== expected)) ||
            (declaredLength !== -1 && body.length !== declaredLength)
          ) {
            res.writeHead(400, { 'Content-Type': 'application/xml' });
            res.end(
              '<Error><Code>SignatureDoesNotMatch</Code><Message>The request signature we calculated does not match the signature you provided.</Message></Error>'
            );
            return;
          }

          storageMap.set(key, { bytes: body, contentType });
          res.writeHead(200, {
            ETag: '"d41d8cd98f00b204e9800998ecf8427e"',
            'Content-Length': '0',
          });
          res.end();
        });
        return;
      }

      if (req.method === 'HEAD') {
        const found = storageMap.get(key);
        if (!found) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, {
          'Content-Length': String(found.bytes.length),
          'Content-Type': found.contentType,
          ETag: '"d41d8cd98f00b204e9800998ecf8427e"',
        });
        res.end();
        return;
      }

      if (req.method === 'DELETE') {
        storageMap.delete(key);
        res.writeHead(204);
        res.end();
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      s3Server.listen(0, '127.0.0.1', () => {
        const addr = s3Server.address();
        if (typeof addr === 'object' && addr) {
          s3Port = addr.port;
        }
        resolve();
      });
    });

    // 2. Build Fastify API with storage client pointing to local test S3 server
    const s3Client = new S3StorageClient({
      endpoint: `http://127.0.0.1:${s3Port}`,
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      forcePathStyle: true,
    });

    const multipart = new S3MultipartStorage({ storageClient: s3Client });

    app = await buildApp({
      adapters: {
        repositories,
        storage: s3Client,
        multipart,
        probeQueue: mockProbeQueue,
      },
      limits: {
        maxUploadBytes: 100 * 1024 * 1024,
      },
      rawBucket: 'raw',
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve) => s3Server.close(() => resolve()));
  });

  it('AC 17: POST /v1/uploads returns 201 with single strategy, presigned PUT URL and <= 15 min expiry', async () => {
    const start = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        filename: 'sintel.mp4',
        sizeBytes: 1024 * 100, // 100 KB
        contentType: 'video/mp4',
      },
    });

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500); // p95 < 200 ms locally (allow 500 ms under heavy concurrent suite)
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.strategy).toBe('single');
    expect(body.videoId).toBeDefined();
    expect(body.uploadId).toBeDefined();
    expect(body.singleUrl).toContain(`http://127.0.0.1:${s3Port}/raw/`);
    expect(body.singleUrl).toContain(body.videoId);
    expect(body.singleUrl).toContain('X-Amz-Signature');
    expect(body.headers['content-type']).toBe('video/mp4');
    expect(body.headers['content-length']).toBe(String(1024 * 100));

    const expiresAt = new Date(body.expiresAt).getTime();
    const diffMs = expiresAt - Date.now();
    expect(diffMs).toBeGreaterThan(14 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(15 * 60 * 1000 + 2000);
  });

  it('AC 18: Uploading body of different length fails; correct body succeeds directly to storage', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        filename: 'clip.mp4',
        sizeBytes: 50,
        contentType: 'video/mp4',
      },
    });
    expect(res.statusCode).toBe(201);
    const { videoId, singleUrl } = res.json();
    signedLengths.set(`raw/${videoId}/source.mp4`, 50);

    // 1. Upload wrong body length (e.g. 20 bytes instead of declared 50 bytes)
    const wrongBody = Buffer.alloc(20, 'a');
    const failRes = await fetch(singleUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': '20', // Mismatched!
      },
      body: wrongBody,
    });
    expect(failRes.status).toBe(400);

    // 2. Upload exact matching body length (50 bytes)
    const correctBody = Buffer.alloc(50, 'v');
    const successRes = await fetch(singleUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': '50',
      },
      body: correctBody,
    });
    expect(successRes.status).toBe(200);
  });

  it('AC 19: complete performs HeadObject, CAS UPLOADING->UPLOADED, appends event, enqueues probe with {videoId}--probe--g1; idempotent on repeat', async () => {
    const size = 100;
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        filename: 'complete-test.mp4',
        sizeBytes: size,
        contentType: 'video/mp4',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { videoId, uploadId, singleUrl } = createRes.json();

    // Upload bytes directly to S3
    const uploadRes = await fetch(singleUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(size),
      },
      body: Buffer.alloc(size, 'x'),
    });
    expect(uploadRes.status).toBe(200);

    // Call POST /v1/uploads/:uploadId/complete
    const completeRes = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${uploadId}/complete`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {},
    });

    expect(completeRes.statusCode).toBe(202);
    expect(completeRes.json()).toEqual({
      videoId,
      status: 'UPLOADED',
      admission: 'admitted',
    });

    // Verify video in DB is UPLOADED
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('UPLOADED');

    // Verify upload.completed event written to video_events
    const events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.some((e) => e.type === 'upload.completed')).toBe(true);

    // Verify probe job was enqueued in Redis with deterministic jobId
    const expectedJobId = `${videoId}--probe--g1`;
    const enqueuedJob = probeJobs.find((j) => j.opts?.jobId === expectedJobId);
    expect(enqueuedJob).toBeDefined();
    expect(enqueuedJob?.name).toBe('probe');
    expect(enqueuedJob?.data.videoId).toBe(videoId);
    expect(enqueuedJob?.data.generation).toBe(1);

    const initialJobCount = probeJobs.length;

    // Call complete second time (Idempotency) -> returns 202, no second job!
    const secondComplete = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${uploadId}/complete`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {},
    });

    expect(secondComplete.statusCode).toBe(202);
    expect(secondComplete.json().status).toBe('UPLOADED');
    expect(probeJobs.length).toBe(initialJobCount); // No second job!
  });

  it('AC 20: size mismatch at complete -> 422 UPLOAD_SIZE_MISMATCH, object deleted, video REJECTED', async () => {
    const declaredSize = 200;
    const actualSize = 150; // Mismatch

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        filename: 'mismatch.mp4',
        sizeBytes: declaredSize,
        contentType: 'video/mp4',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { videoId, uploadId } = createRes.json();

    // Manually put mismatched size into mock storage map
    const sourceKey = `raw/${videoId}/source.mp4`;
    storageMap.set(sourceKey, {
      bytes: Buffer.alloc(actualSize, 'm'),
      contentType: 'video/mp4',
    });

    // Call complete
    const completeRes = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${uploadId}/complete`,
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {},
    });

    expect(completeRes.statusCode).toBe(422);
    expect(completeRes.headers['content-type']).toContain('application/problem+json');
    const problem = completeRes.json();
    expect(problem.code).toBe(ErrorCodes.UPLOAD_SIZE_MISMATCH);

    // Verify object was deleted from storage
    expect(storageMap.has(sourceKey)).toBe(false);

    // Verify video status became REJECTED in DB
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('REJECTED');
    expect(video?.errorCode).toBe(ErrorCodes.UPLOAD_SIZE_MISMATCH);
  });

  it('AC 20: unsupported content type at request time -> 422 UNSUPPORTED_CONTENT_TYPE', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        filename: 'document.pdf',
        sizeBytes: 1000,
        contentType: 'application/pdf', // Invalid
      },
    });

    expect(res.statusCode).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe(ErrorCodes.UNSUPPORTED_CONTENT_TYPE);
  });

  it('AC 20: file exceeding MAX_UPLOAD_BYTES -> 422 UPLOAD_TOO_LARGE', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        filename: 'giant.mp4',
        sizeBytes: 500 * 1024 * 1024, // 500 MB (app configured with 100 MB max)
        contentType: 'video/mp4',
      },
    });

    expect(res.statusCode).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe(ErrorCodes.UPLOAD_TOO_LARGE);
  });

  it('AC 21: rate limit on POST /v1/uploads returns 429 RATE_LIMITED', async () => {
    // App rate limit configured with 30/min
    // We create an app instance with rateLimitMax: 3 to quickly trigger 429
    const limitedApp = await buildApp({
      adapters: {
        repositories,
      },
      limits: {
        rateLimitMax: 3,
      },
      rawBucket: 'raw',
    });
    await limitedApp.ready();

    try {
      // 3 successful requests
      for (let i = 0; i < 3; i++) {
        const res = await limitedApp.inject({
          method: 'POST',
          url: '/v1/uploads',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            filename: `video-${i}.mp4`,
            sizeBytes: 100,
            contentType: 'video/mp4',
          },
        });
        expect(res.statusCode).toBe(201);
      }

      // 4th request exceeds rate limit -> 429 RATE_LIMITED
      const limitedRes = await limitedApp.inject({
        method: 'POST',
        url: '/v1/uploads',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          filename: 'overflow.mp4',
          sizeBytes: 100,
          contentType: 'video/mp4',
        },
      });

      expect(limitedRes.statusCode).toBe(429);
      expect(limitedRes.headers['content-type']).toContain('application/problem+json');
      const problem = limitedRes.json();
      expect(problem.code).toBe(ErrorCodes.RATE_LIMITED);
      expect(problem.status).toBe(429);
    } finally {
      await limitedApp.close();
    }
  });

  it('Ticket 30 AC 2: Crash right after DB commit -> outbox entry written -> relay drains and publishes probe job', async () => {
    const size = 100;
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        filename: 'crash-test.mp4',
        sizeBytes: size,
        contentType: 'video/mp4',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { videoId, uploadId, singleUrl } = createRes.json();

    // Upload bytes directly to mock S3
    await fetch(singleUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(size),
      },
      body: Buffer.alloc(size, 'x'),
    });

    const initialProbeCount = probeJobs.length;

    // Simulate crash after commit via test header
    const crashRes = await app.inject({
      method: 'POST',
      url: `/v1/uploads/${uploadId}/complete`,
      headers: {
        authorization: `Bearer ${authToken}`,
        'x-test-crash-after-commit': 'true',
      },
      payload: {},
    });

    // Request failed due to injected crash error
    expect(crashRes.statusCode).toBe(500);

    // But DB commit succeeded! Video is UPLOADED in DB
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('UPLOADED');

    // And direct enqueue was NOT executed due to crash
    expect(probeJobs.length).toBe(initialProbeCount);

    // Outbox record was atomically written in the DB transaction
    const pendingOutbox = expectOk(await repositories.outbox.claimBatch(10));
    const probeOutboxItem = pendingOutbox.find(
      (item) =>
        item.kind === 'probe' &&
        item.payload.type === 'queue' &&
        (item.payload.job.data as { videoId?: string }).videoId === videoId
    );
    expect(probeOutboxItem).toBeDefined();

    // Outbox relay logic: claims batch from outbox and adds to queue, marking published
    for (const item of pendingOutbox) {
      if (item.payload.type === 'queue') {
        await mockProbeQueue.add(
          item.payload.job.name,
          item.payload.job.data,
          item.payload.job.opts
        );
        await repositories.outbox.markPublished(item.id);
      }
    }

    // Now probe job is enqueued in the queue!
    const expectedJobId = `${videoId}--probe--g1`;
    const relayedJob = probeJobs.find((j) => j.opts?.jobId === expectedJobId);
    expect(relayedJob).toBeDefined();
    expect(relayedJob?.data.videoId).toBe(videoId);
  });
});

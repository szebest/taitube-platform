import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { type FakeS3, startFakeS3 } from './fake-s3';
import { buildInMemoryApp } from './in-memory-app';
import { postUpload, putObject } from './upload-requests';

const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';

describe('apps/api single-part upload initiation', () => {
  let app: FastifyInstance;
  let s3: FakeS3;
  const authToken = mintToken({ sub: DEV_USER_ID, role: 'user', ttl: '1h' });

  beforeAll(async () => {
    s3 = await startFakeS3();
    ({ app } = await buildInMemoryApp({
      adapters: { storage: s3.storage, multipart: s3.multipart },
      config: inProcessAppConfig({ limits: { maxUploadBytes: 100 * 1024 * 1024 } }),
    }));
  });

  afterAll(async () => {
    await app.close();
    await s3.close();
  });

  it('answers POST /v1/uploads with 201, a single presigned PUT URL and an expiry within 15 minutes', async () => {
    const start = Date.now();
    const res = await postUpload(app, authToken, { filename: 'sintel.mp4', sizeBytes: 1024 * 100 });

    expect(Date.now() - start).toBeLessThan(500);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.strategy).toBe('single');
    expect(body.videoId).toBeDefined();
    expect(body.uploadId).toBeDefined();
    expect(body.singleUrl).toContain(`${s3.endpoint}/raw/`);
    expect(body.singleUrl).toContain(body.videoId);
    expect(body.singleUrl).toContain('X-Amz-Signature');
    expect(body.headers['content-type']).toBe('video/mp4');
    expect(body.headers['content-length']).toBe(String(1024 * 100));
    const diffMs = new Date(body.expiresAt).getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(14 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(15 * 60 * 1000 + 2000);
  });

  it('lets storage refuse a body of the wrong length and accept the signed one', async () => {
    const res = await postUpload(app, authToken, { filename: 'clip.mp4', sizeBytes: 50 });
    expect(res.statusCode).toBe(201);
    const { videoId, singleUrl } = res.json();
    s3.signedLengths.set(`raw/${videoId}/source.mp4`, 50);

    expect((await putObject(singleUrl, 20)).status).toBe(400);
    expect((await putObject(singleUrl, 50)).status).toBe(200);
  });

  it.each([
    {
      name: 'an unsupported content type',
      request: { filename: 'document.pdf', sizeBytes: 1000, contentType: 'application/pdf' },
      code: ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
    },
    {
      name: 'a file over MAX_UPLOAD_BYTES',
      request: { filename: 'giant.mp4', sizeBytes: 500 * 1024 * 1024 },
      code: ErrorCodes.UPLOAD_TOO_LARGE,
    },
  ])('refuses $name at request time with 422', async ({ request, code }) => {
    const res = await postUpload(app, authToken, request);

    expect(res.statusCode).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe(code);
  });

  it('rate-limits POST /v1/uploads with 429 RATE_LIMITED', async () => {
    const { app: limitedApp } = await buildInMemoryApp({
      config: inProcessAppConfig({ limits: { uploadRateLimitMax: 3 } }),
    });

    try {
      for (let i = 0; i < 3; i++) {
        const res = await postUpload(limitedApp, authToken, {
          filename: `video-${i}.mp4`,
          sizeBytes: 100,
        });
        expect(res.statusCode).toBe(201);
      }

      const limitedRes = await postUpload(limitedApp, authToken, {
        filename: 'overflow.mp4',
        sizeBytes: 100,
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
});

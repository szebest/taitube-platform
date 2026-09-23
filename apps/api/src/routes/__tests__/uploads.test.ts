import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

const USER = '00000000-0000-7000-8000-000000000001';
const ABSENT_UPLOAD = '018f0000-0000-7000-8000-0000000000ff';
const START = { filename: 'clip.mp4', sizeBytes: 1024, contentType: 'video/mp4' };

describe('upload routes', () => {
  let app: FastifyInstance;
  const auth = { authorization: `Bearer ${mintToken({ sub: USER, role: 'user', ttl: '1h' })}` };

  beforeEach(async () => {
    app = await buildApp({
      adapters: { repositories: new InMemoryRepositories() },
      config: inProcessAppConfig({ limits: { uploadRateLimitMax: 2 } }),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([
    { method: 'POST' as const, url: '/v1/uploads', payload: START },
    { method: 'GET' as const, url: `/v1/uploads/${ABSENT_UPLOAD}`, payload: undefined },
    { method: 'POST' as const, url: `/v1/uploads/${ABSENT_UPLOAD}/parts`, payload: undefined },
    { method: 'POST' as const, url: `/v1/uploads/${ABSENT_UPLOAD}/complete`, payload: {} },
    { method: 'DELETE' as const, url: `/v1/uploads/${ABSENT_UPLOAD}`, payload: undefined },
  ])('refuses an anonymous $method $url with 401', async ({ method, url, payload }) => {
    const res = await app.inject({ method, url, ...(payload ? { payload } : {}) });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('starts an upload with 201 and a presigned single URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: auth,
      payload: START,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ strategy: 'single' });
    expect(res.json().singleUrl).toContain(res.json().videoId);
  });

  it.each([
    {
      failure: 'a body missing its filename',
      payload: { sizeBytes: 1024, contentType: 'video/mp4' },
      status: 400,
    },
    {
      failure: 'an unsupported content type',
      payload: { ...START, contentType: 'application/pdf' },
      status: 422,
      code: ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
    },
  ])('answers $failure with $status', async ({ payload, status, code }) => {
    const res = await app.inject({ method: 'POST', url: '/v1/uploads', headers: auth, payload });

    expect(res.statusCode).toBe(status);
    if (code) expect(res.json().code).toBe(code);
  });

  it('answers 429 once the configured start rate is spent', async () => {
    const start = () =>
      app.inject({ method: 'POST', url: '/v1/uploads', headers: auth, payload: START });
    await start();
    await start();

    const res = await start();

    expect(res.statusCode).toBe(429);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe(ErrorCodes.RATE_LIMITED);
  });

  it('answers 400 on an upload id that is not a UUID', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/uploads/not-a-uuid', headers: auth });

    expect(res.statusCode).toBe(400);
  });

  it('answers 404 for an upload that does not exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/uploads/${ABSENT_UPLOAD}`,
      headers: auth,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });
});

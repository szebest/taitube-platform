import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { QUEUES } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { ADMIN_TOKEN, TOKENS, bearer, buildTestApp, inMemoryQueues } from './test-app';

describe('Bull Board admin queues', () => {
  let app: FastifyInstance;
  const transcode = new InMemoryJobQueue('transcode-720p');

  beforeAll(async () => {
    ({ app } = await buildTestApp({
      config: inProcessAppConfig({ auth: { adminToken: ADMIN_TOKEN } }),
      adapters: { queues: inMemoryQueues(transcode) },
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    { name: 'no credentials', headers: {}, status: 401, code: 'UNAUTHORIZED' },
    { name: 'a non-admin JWT', headers: bearer(TOKENS.otherUser), status: 403, code: 'FORBIDDEN' },
    {
      name: 'an invalid x-admin-token',
      headers: { 'x-admin-token': 'wrong-invalid-secret-token' },
      status: 401,
      code: 'UNAUTHORIZED',
    },
  ])('answers $name with $status problem+json', async ({ headers, status, code }) => {
    const res = await app.inject({ method: 'GET', url: '/admin/queues', headers });

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(code);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('serves the Bull Board UI to a valid x-admin-token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/queues',
      headers: { 'x-admin-token': ADMIN_TOKEN },
    });

    expect([200, 301, 302]).toContain(res.statusCode);
  });

  it('lists every queue, dlq included, to an admin JWT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/queues/api/queues',
      headers: bearer(TOKENS.admin),
    });

    expect(res.statusCode).toBe(200);
    const exposedQueueNames = res.json().queues.map((q: { name: string }) => q.name);
    expect(exposedQueueNames).toEqual(expect.arrayContaining([...QUEUES, 'dlq']));
  });

  it('pauses and resumes transcode-720p through the Bull Board API', async () => {
    const pauseRes = await app.inject({
      method: 'PUT',
      url: '/admin/queues/api/queues/transcode-720p/pause',
      headers: bearer(TOKENS.admin),
    });
    expect(pauseRes.statusCode).toBe(200);
    expect(expectOk(await transcode.isPaused())).toBe(true);

    const resumeRes = await app.inject({
      method: 'PUT',
      url: '/admin/queues/api/queues/transcode-720p/resume',
      headers: bearer(TOKENS.admin),
    });
    expect(resumeRes.statusCode).toBe(200);
    expect(expectOk(await transcode.isPaused())).toBe(false);
  });
});

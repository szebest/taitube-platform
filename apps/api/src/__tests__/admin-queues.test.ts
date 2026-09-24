import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import type { JobQueue } from '@vp/core/ports';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { QUEUES } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { composeApp } from '../app';
import { bearer } from './in-memory-app';

const ADMIN_USER_ID = '00000000-0000-7000-8000-000000000003';
const REGULAR_USER_ID = '00000000-0000-7000-8000-000000000002';
const VALID_ADMIN_TOKEN = 'operator-token-for-tests';

describe('Bull Board admin queues', () => {
  let app: FastifyInstance;
  const queuesMap = new Map<string, JobQueue>(
    QUEUES.map((name) => [name, new InMemoryJobQueue(name)])
  );
  const adminJwt = mintToken({ sub: ADMIN_USER_ID, role: 'admin', ttl: '1h' });
  const regularJwt = mintToken({ sub: REGULAR_USER_ID, role: 'user', ttl: '1h' });

  beforeAll(async () => {
    app = (
      await composeApp({
        config: inProcessAppConfig({ auth: { adminToken: VALID_ADMIN_TOKEN } }),
        adapters: { queues: queuesMap },
      })
    ).app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    { name: 'no credentials', headers: {}, status: 401, code: 'UNAUTHORIZED' },
    { name: 'a non-admin JWT', headers: bearer(regularJwt), status: 403, code: 'FORBIDDEN' },
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
      headers: { 'x-admin-token': VALID_ADMIN_TOKEN },
    });

    expect([200, 301, 302]).toContain(res.statusCode);
  });

  it('lists every queue, dlq included, to an admin JWT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/queues/api/queues',
      headers: bearer(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const exposedQueueNames = res.json().queues.map((q: { name: string }) => q.name);
    expect(exposedQueueNames).toEqual(expect.arrayContaining([...QUEUES, 'dlq']));
  });

  it('pauses and resumes transcode-720p through the Bull Board API', async () => {
    const queue720p = queuesMap.get('transcode-720p');
    if (!queue720p) throw new Error('transcode-720p queue missing');

    const pauseRes = await app.inject({
      method: 'PUT',
      url: '/admin/queues/api/queues/transcode-720p/pause',
      headers: bearer(adminJwt),
    });
    expect(pauseRes.statusCode).toBe(200);
    expect(expectOk(await queue720p.isPaused())).toBe(true);

    const resumeRes = await app.inject({
      method: 'PUT',
      url: '/admin/queues/api/queues/transcode-720p/resume',
      headers: bearer(adminJwt),
    });
    expect(resumeRes.statusCode).toBe(200);
    expect(expectOk(await queue720p.isPaused())).toBe(false);
  });
});

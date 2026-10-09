import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { QUEUES } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import {
  ADMIN_TOKEN,
  TOKENS,
  bearer,
  buildTestApp,
  inMemoryQueues,
} from '../../../__tests__/test-app';

describe('admin queues board', () => {
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
    { caller: 'an anonymous caller', headers: {}, status: 401, code: ErrorCodes.UNAUTHORIZED },
    {
      caller: 'a wrong admin token',
      headers: { 'x-admin-token': 'not-the-operator-token' },
      status: 401,
      code: ErrorCodes.UNAUTHORIZED,
    },
    {
      caller: 'a non-admin user',
      headers: bearer(TOKENS.user),
      status: 403,
      code: ErrorCodes.FORBIDDEN,
    },
  ])(
    'gates the board against $caller with a $status problem',
    async ({ headers, status, code }) => {
      const res = await app.inject({ method: 'GET', url: '/admin/queues/api/queues', headers });

      expect(res.statusCode).toBe(status);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.json().code).toBe(code);
    }
  );

  it('serves the board UI to the operator token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/queues',
      headers: { 'x-admin-token': ADMIN_TOKEN },
    });

    expect([200, 301, 302]).toContain(res.statusCode);
  });

  it('lists every pipeline queue and the DLQ to an admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/queues/api/queues',
      headers: bearer(TOKENS.admin),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().queues.map((queue: { name: string }) => queue.name)).toEqual(
      expect.arrayContaining([...QUEUES, 'dlq'])
    );
  });

  it('pauses and resumes a queue for an admin', async () => {
    const queueUrl = '/admin/queues/api/queues/transcode-720p';
    const headers = bearer(TOKENS.admin);

    const paused = await app.inject({ method: 'PUT', url: `${queueUrl}/pause`, headers });
    expect(paused.statusCode).toBe(200);
    expect(expectOk(await transcode.isPaused())).toBe(true);

    const resumed = await app.inject({ method: 'PUT', url: `${queueUrl}/resume`, headers });
    expect(resumed.statusCode).toBe(200);
    expect(expectOk(await transcode.isPaused())).toBe(false);
  });
});

import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { QUEUES } from '@vp/job-contracts';
import type { FastifyInstance } from 'fastify';
import { ADMIN_TOKEN, TOKENS, bearer, buildTestApp } from '../../../__tests__/test-app';

describe('admin queues board', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    ({ app } = await buildTestApp({
      config: inProcessAppConfig({ auth: { adminToken: ADMIN_TOKEN } }),
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

  it('serves the board to an operator with every pipeline queue', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/queues/api/queues',
      headers: bearer(TOKENS.admin),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().queues.map((queue: { name: string }) => queue.name)).toEqual(
      expect.arrayContaining([...QUEUES])
    );
  });
});

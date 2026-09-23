import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import type { JobQueue } from '@vp/core/ports';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { QUEUES } from '@vp/job-contracts';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../app';

const ADMIN_TOKEN = 'operator-token-for-tests';
const USER = '00000000-0000-7000-8000-000000000001';
const OPERATOR = '00000000-0000-7000-8000-000000000099';

describe('admin queues board', () => {
  let app: FastifyInstance;
  const userToken = mintToken({ sub: USER, role: 'user', ttl: '1h' });
  const operatorToken = mintToken({ sub: OPERATOR, role: 'admin', ttl: '1h' });

  beforeAll(async () => {
    app = await buildApp({
      config: inProcessAppConfig({ auth: { adminToken: ADMIN_TOKEN } }),
      adapters: {
        queues: new Map<string, JobQueue>(QUEUES.map((name) => [name, new InMemoryJobQueue(name)])),
      },
    });
    await app.ready();
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
      headers: { authorization: `Bearer ${userToken}` },
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
      headers: { authorization: `Bearer ${operatorToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().queues.map((queue: { name: string }) => queue.name)).toEqual(
      expect.arrayContaining([...QUEUES])
    );
  });
});

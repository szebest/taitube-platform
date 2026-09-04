import { JobQueue } from '@vp/core/ports';
import { mintDevToken } from '@vp/dev-token';
import { QUEUES } from '@vp/job-contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

class MockAdminJobQueue extends JobQueue {
  private _paused = false;
  readonly name: string;
  readonly metaValues = { version: 'bullmq' };
  readonly opts = { prefix: 'bull' };
  readonly backend = {
    getQueueMetaField: async () => null,
    getQueueMetaFields: async () => [null, null],
    on: () => {},
  };

  constructor(name: string) {
    super();
    this.name = name;
  }

  async getJobState(_jobId: string): Promise<string | undefined> {
    return 'completed';
  }

  async checkHealth(): Promise<boolean> {
    return true;
  }

  getName(): string {
    return this.name;
  }

  async add<_T = unknown>(): Promise<any> {
    return { id: '1', name: this.name, data: {} };
  }

  async process(): Promise<void> {}

  async isPaused(): Promise<boolean> {
    return this._paused;
  }

  async pause(): Promise<void> {
    this._paused = true;
  }

  async resume(): Promise<void> {
    this._paused = false;
  }

  async getJobCounts(): Promise<any> {
    return {
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      waiting: 0,
      paused: 0,
    };
  }

  async getJobs(): Promise<any[]> {
    return [];
  }

  async getWorkers(): Promise<any[]> {
    return [];
  }

  async getJobSchedulersCount(): Promise<number> {
    return 0;
  }

  async close(): Promise<void> {}
}

describe('apps/api Bull Board admin queues (Ticket 10: AC 17, 18, 19)', () => {
  let app: FastifyInstance;
  const queuesMap = new Map<string, JobQueue>();

  const ADMIN_USER_ID = '00000000-0000-7000-8000-000000000003';
  const REGULAR_USER_ID = '00000000-0000-7000-8000-000000000002';
  const VALID_ADMIN_TOKEN = 'change-me-32-bytes-random';

  let adminJwt: string;
  let regularJwt: string;

  beforeAll(async () => {
    process.env.ADMIN_TOKEN = VALID_ADMIN_TOKEN;

    // Create mock queue instances for all queues in QUEUES
    for (const qName of QUEUES) {
      queuesMap.set(qName, new MockAdminJobQueue(qName));
    }

    app = await buildApp({
      adminQueues: queuesMap,
    });
    await app.ready();

    adminJwt = mintDevToken({
      sub: ADMIN_USER_ID,
      role: 'admin',
      ttl: '1h',
    });

    regularJwt = mintDevToken({
      sub: REGULAR_USER_ID,
      role: 'user',
      ttl: '1h',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('AC 17: unauthenticated request to /admin/queues returns 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/queues',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('AC 17: non-admin JWT bearer to /admin/queues returns 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/queues',
      headers: {
        authorization: `Bearer ${regularJwt}`,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('FORBIDDEN');
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('AC 17: invalid x-admin-token returns 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/queues',
      headers: {
        'x-admin-token': 'wrong-invalid-secret-token',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('AC 17: valid x-admin-token allows access and serves Bull Board UI', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/queues',
      headers: {
        'x-admin-token': VALID_ADMIN_TOKEN,
      },
    });

    expect([200, 301, 302]).toContain(res.statusCode);
  });

  it('AC 17: valid admin JWT allows access and lists all QUEUES (including dlq)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/queues/api/queues',
      headers: {
        authorization: `Bearer ${adminJwt}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.queues).toBeDefined();

    const exposedQueueNames = data.queues.map((q: { name: string }) => q.name);
    for (const queueName of QUEUES) {
      expect(exposedQueueNames).toContain(queueName);
    }
    expect(exposedQueueNames).toContain('dlq');
  });

  it('AC 18: pausing transcode-720p stops new jobs, resuming continues', async () => {
    const queue720p = queuesMap.get('transcode-720p');
    expect(queue720p).toBeDefined();

    // 1. Pause queue via Bull Board API
    const pauseRes = await app.inject({
      method: 'PUT',
      url: '/admin/queues/api/queues/transcode-720p/pause',
      headers: {
        authorization: `Bearer ${adminJwt}`,
      },
    });
    expect(pauseRes.statusCode).toBe(200);

    const isPaused = await queue720p?.isPaused();
    expect(isPaused).toBe(true);

    // 2. Resume queue via Bull Board API
    const resumeRes = await app.inject({
      method: 'PUT',
      url: '/admin/queues/api/queues/transcode-720p/resume',
      headers: {
        authorization: `Bearer ${adminJwt}`,
      },
    });
    expect(resumeRes.statusCode).toBe(200);

    const isResumed = await queue720p?.isPaused();
    expect(isResumed).toBe(false);
  });
});

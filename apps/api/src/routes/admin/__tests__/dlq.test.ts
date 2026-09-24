import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { QUEUES } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { uuidv7 } from 'uuidv7';
import { composeApp } from '../../../app';
import { SEEDED } from '@vp/testing';

const ADMIN_TOKEN = 'operator-token-for-tests';
const USER = SEEDED.userId;
const VIDEO = '018f0000-0000-7000-8000-000000000010';

describe('admin DLQ routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let queues: Map<string, InMemoryJobQueue>;
  const userToken = mintToken({ sub: USER, role: 'user', ttl: '1h' });
  const admin = { 'x-admin-token': ADMIN_TOKEN };

  async function park(status: 'PARKED' | 'REPLAYED' = 'PARKED'): Promise<string> {
    const id = uuidv7();
    const entry = await repositories.dlq.create({
      id,
      queue: 'transcode-720p',
      jobId: status === 'PARKED' ? `${VIDEO}--transcode--720p--g1` : `${VIDEO}--${id}`,
      videoId: VIDEO,
      errorCode: 'FFMPEG_FAILED',
      errorMessage: 'FFmpeg transcode failed',
      attemptsMade: 4,
      payload: { videoId: VIDEO, rendition: { name: '720p' }, generation: 1 },
      status,
    });
    return expectOk(entry).id;
  }

  beforeAll(async () => {
    repositories = new InMemoryRepositories();
    queues = new Map(QUEUES.map((name) => [name, new InMemoryJobQueue(name)]));
    app = (
      await composeApp({
        config: inProcessAppConfig({ auth: { adminToken: ADMIN_TOKEN } }),
        adapters: { repositories, queues: new Map(queues) },
      })
    ).app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
  });

  it.each([
    { caller: 'an anonymous caller', headers: {}, status: 401 },
    { caller: 'a non-admin user', headers: { authorization: `Bearer ${userToken}` }, status: 403 },
    { caller: 'an operator', headers: admin, status: 200 },
  ])('answers $caller listing the DLQ with $status', async ({ headers, status }) => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/dlq', headers });

    expect(res.statusCode).toBe(status);
  });

  it('passes the status filter through to the listing', async () => {
    await park('PARKED');
    const replayed = await park('REPLAYED');

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/dlq?status=REPLAYED',
      headers: admin,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((item: { id: string }) => item.id)).toEqual([replayed]);
  });

  it('answers 400 on a status outside the DLQ vocabulary', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/dlq?status=LOST',
      headers: admin,
    });

    expect(res.statusCode).toBe(400);
  });

  it('replays an entry with 202 onto its origin queue', async () => {
    const id = await park();
    const origin = queues.get('transcode-720p');
    if (!origin) throw new Error('transcode-720p queue missing');
    origin.enqueuedJobs.length = 0;

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/dlq/${id}/replay`,
      headers: admin,
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ dlqEntryId: id, status: 'REPLAYED' });
    expect(origin.enqueuedJobs.map((job) => job.id)).toEqual([`${VIDEO}--transcode--720p--g1--r1`]);
  });

  it('discards an entry with an empty 204', async () => {
    const id = await park();

    const res = await app.inject({ method: 'DELETE', url: `/v1/admin/dlq/${id}`, headers: admin });

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(expectOk(await repositories.dlq.findById(id))?.status).toBe('DISCARDED');
  });

  it.each([
    { action: 'replay', method: 'POST' as const, url: '/v1/admin/dlq/absent-entry/replay' },
    { action: 'discard', method: 'DELETE' as const, url: '/v1/admin/dlq/absent-entry' },
  ])('answers a $action of an absent entry with 404', async ({ method, url }) => {
    const res = await app.inject({ method, url, headers: admin });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(ErrorCodes.DLQ_ENTRY_NOT_FOUND);
  });
});

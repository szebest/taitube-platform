import { InMemoryJobQueue, type InMemoryRepositories } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { uuidv7 } from 'uuidv7';
import {
  ADMIN_TOKEN,
  TOKENS,
  bearer,
  buildTestApp,
  inMemoryQueues,
} from '../../../__tests__/test-app';

const VIDEO = '018f0000-0000-7000-8000-000000000010';

describe('admin DLQ routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  const transcode = new InMemoryJobQueue('transcode-720p');
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
    ({ app, repositories } = await buildTestApp({
      config: inProcessAppConfig({ auth: { adminToken: ADMIN_TOKEN } }),
      adapters: { queues: inMemoryQueues(transcode) },
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
  });

  it.each([
    { caller: 'an anonymous caller', headers: {}, status: 401 },
    { caller: 'a non-admin user', headers: bearer(TOKENS.user), status: 403 },
    { caller: 'an operator', headers: admin, status: 200 },
    { caller: 'an admin by Bearer JWT', headers: bearer(TOKENS.admin), status: 200 },
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

  it('pages the listing with limit and the cursor it hands back', async () => {
    for (let i = 0; i < 4; i++) await park('REPLAYED');

    const first = await app.inject({ method: 'GET', url: '/v1/admin/dlq?limit=2', headers: admin });
    const { items: firstItems, nextCursor } = first.json();
    const second = await app.inject({
      method: 'GET',
      url: `/v1/admin/dlq?limit=2&cursor=${encodeURIComponent(nextCursor)}`,
      headers: admin,
    });
    const secondIds = second.json().items.map((item: { id: string }) => item.id);

    expect(firstItems).toHaveLength(2);
    expect(secondIds).toHaveLength(2);
    expect(secondIds).not.toContain(firstItems[0].id);
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
    transcode.enqueuedJobs.length = 0;

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/dlq/${id}/replay`,
      headers: admin,
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ dlqEntryId: id, status: 'REPLAYED' });
    expect(transcode.enqueuedJobs.map((job) => job.id)).toEqual([
      `${VIDEO}--transcode--720p--g1--r1`,
    ]);
    expect(expectOk(await repositories.dlq.findById(id))).toMatchObject({ status: 'REPLAYED' });
    const events = expectOk(await repositories.events.findByVideoId(VIDEO));
    expect(events.find((event) => event.type === 'dlq.replayed')?.payload).toMatchObject({
      dlqEntryId: id,
      originQueue: 'transcode-720p',
      originalJobId: `${VIDEO}--transcode--720p--g1`,
      replayJobId: `${VIDEO}--transcode--720p--g1--r1`,
    });
  });

  it('discards an entry with an empty 204', async () => {
    const id = await park();

    const res = await app.inject({ method: 'DELETE', url: `/v1/admin/dlq/${id}`, headers: admin });

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(expectOk(await repositories.dlq.findById(id))?.status).toBe('DISCARDED');
    const events = expectOk(await repositories.events.findByVideoId(VIDEO));
    expect(events.find((event) => event.type === 'dlq.discarded')?.payload).toMatchObject({
      dlqEntryId: id,
      originQueue: 'transcode-720p',
    });
  });

  it.each([
    { action: 'replay', method: 'POST' as const, suffix: '/replay', headers: {}, status: 401 },
    { action: 'discard', method: 'DELETE' as const, suffix: '', headers: {}, status: 401 },
    {
      action: 'replay',
      method: 'POST' as const,
      suffix: '/replay',
      headers: bearer(TOKENS.user),
      status: 403,
    },
    {
      action: 'discard',
      method: 'DELETE' as const,
      suffix: '',
      headers: bearer(TOKENS.user),
      status: 403,
    },
  ])('refuses a $action by a caller who is not an admin with $status', async (refused) => {
    const id = await park();

    const res = await app.inject({
      method: refused.method,
      url: `/v1/admin/dlq/${id}${refused.suffix}`,
      headers: refused.headers,
    });

    expect(res.statusCode).toBe(refused.status);
    expect(expectOk(await repositories.dlq.findById(id))?.status).toBe('PARKED');
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

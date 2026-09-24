import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import {
  ADMIN_TOKEN,
  TOKENS,
  type TestApp,
  bearer,
  buildTestApp,
  inMemoryQueues,
} from './test-app';

describe('admin DLQ endpoints', () => {
  let ctx: TestApp;
  const transcode = new InMemoryJobQueue('transcode-720p');

  beforeAll(async () => {
    ctx = await buildTestApp({
      config: inProcessAppConfig({ auth: { adminToken: ADMIN_TOKEN } }),
      adapters: { queues: inMemoryQueues(transcode) },
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('GET /admin/dlq', () => {
    beforeAll(async () => {
      for (let i = 1; i <= 5; i++) {
        await ctx.repositories.dlq.create({
          id: uuidv7(),
          queue: 'transcode-720p',
          jobId: `job-${i}`,
          videoId: `018f0000-0000-7000-8000-00000000000${i}`,
          errorCode: i % 2 === 0 ? 'CORRUPT_CONTAINER' : 'STORAGE_UNAVAILABLE',
          errorMessage: `Failure ${i}`,
          attemptsMade: 1,
          payload: { videoId: `018f0000-0000-7000-8000-00000000000${i}` },
          status: i === 5 ? 'REPLAYED' : 'PARKED',
        });
      }
    });

    it.each([
      { caller: 'an anonymous caller', headers: {}, status: 401 },
      { caller: 'a user who is not an admin', headers: bearer(TOKENS.otherUser), status: 403 },
      { caller: 'an admin by Bearer JWT', headers: bearer(TOKENS.admin), status: 200 },
      {
        caller: 'an admin by x-admin-token',
        headers: { 'x-admin-token': ADMIN_TOKEN },
        status: 200,
      },
    ])('answers $caller with $status', async ({ headers, status }) => {
      const res = await ctx.app.inject({ method: 'GET', url: '/admin/dlq', headers });
      expect(res.statusCode).toBe(status);
    });

    it('supports pagination with limit and cursor', async () => {
      const firstPage = await ctx.app.inject({
        method: 'GET',
        url: '/admin/dlq?limit=2',
        headers: bearer(TOKENS.admin),
      });
      expect(firstPage.statusCode).toBe(200);
      const page1 = firstPage.json();
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).toBeDefined();

      const secondPage = await ctx.app.inject({
        method: 'GET',
        url: `/admin/dlq?limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`,
        headers: bearer(TOKENS.admin),
      });
      expect(secondPage.statusCode).toBe(200);
      const page2 = secondPage.json();
      expect(page2.items).toHaveLength(2);
      expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
    });

    it('supports filtering by status', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/admin/dlq?status=REPLAYED',
        headers: bearer(TOKENS.admin),
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.items.length).toBeGreaterThanOrEqual(1);
      expect(data.items.every((i: { status: string }) => i.status === 'REPLAYED')).toBe(true);
    });
  });

  describe.each([
    { method: 'POST' as const, url: (id: string) => `/admin/dlq/${id}/replay` },
    { method: 'DELETE' as const, url: (id: string) => `/admin/dlq/${id}` },
  ])('$method on a DLQ entry', ({ method, url }) => {
    it('requires admin access', async () => {
      const unauth = await ctx.app.inject({ method, url: url(uuidv7()) });
      expect(unauth.statusCode).toBe(401);

      const forbidden = await ctx.app.inject({
        method,
        url: url(uuidv7()),
        headers: bearer(TOKENS.user),
      });
      expect(forbidden.statusCode).toBe(403);
    });

    it('returns 404 for nonexistent DLQ entry', async () => {
      const res = await ctx.app.inject({
        method,
        url: url('nonexistent-id'),
        headers: bearer(TOKENS.admin),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe(ErrorCodes.DLQ_ENTRY_NOT_FOUND);
    });
  });

  it('replays an entry to its origin queue with --r1, marks it REPLAYED and audits it', async () => {
    const videoId = '018f0000-0000-7000-8000-000000000010';
    const dlqEntryId = expectOk(
      await ctx.repositories.dlq.create({
        id: uuidv7(),
        queue: 'transcode-720p',
        jobId: `${videoId}--transcode--720p--g1`,
        videoId,
        errorCode: 'FFMPEG_FAILED',
        errorMessage: 'FFmpeg transcode failed',
        attemptsMade: 4,
        payload: { videoId, rendition: { name: '720p' }, generation: 1 },
        status: 'PARKED',
      })
    ).id;
    transcode.enqueuedJobs.length = 0;

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/admin/dlq/${dlqEntryId}/replay`,
      headers: bearer(TOKENS.admin),
    });

    expect(res.statusCode).toBe(202);
    const data = res.json();
    expect(data.status).toBe('REPLAYED');
    expect(data.dlqEntryId).toBe(dlqEntryId);
    expect(data.replayJobId).toBe(`${videoId}--transcode--720p--g1--r1`);

    expect(transcode.enqueuedJobs).toHaveLength(1);
    expect(transcode.enqueuedJobs[0]?.id).toBe(`${videoId}--transcode--720p--g1--r1`);

    const updated = expectOk(await ctx.repositories.dlq.findById(dlqEntryId));
    expect(updated?.status).toBe('REPLAYED');
    expect(updated?.replayedAt).toBeDefined();

    const events = expectOk(await ctx.repositories.events.findByVideoId(videoId));
    const replayEvent = events.find((e) => e.type === 'dlq.replayed');
    expect(replayEvent?.payload).toMatchObject({
      dlqEntryId,
      originQueue: 'transcode-720p',
      originalJobId: `${videoId}--transcode--720p--g1`,
      replayJobId: `${videoId}--transcode--720p--g1--r1`,
    });
  });

  it('discards an entry, marks it DISCARDED and audits it', async () => {
    const videoId = '018f0000-0000-7000-8000-000000000020';
    const dlqEntryId = expectOk(
      await ctx.repositories.dlq.create({
        id: uuidv7(),
        queue: 'probe',
        jobId: `${videoId}--probe--g1`,
        videoId,
        errorCode: 'CORRUPT_CONTAINER',
        errorMessage: 'File contains corrupted moov atom',
        attemptsMade: 1,
        payload: { videoId, sourceKey: 'raw/corrupt.mp4' },
        status: 'PARKED',
      })
    ).id;

    const res = await ctx.app.inject({
      method: 'DELETE',
      url: `/admin/dlq/${dlqEntryId}`,
      headers: bearer(TOKENS.admin),
    });
    expect(res.statusCode).toBe(204);

    const updated = expectOk(await ctx.repositories.dlq.findById(dlqEntryId));
    expect(updated?.status).toBe('DISCARDED');

    const events = expectOk(await ctx.repositories.events.findByVideoId(videoId));
    const discardEvent = events.find((e) => e.type === 'dlq.discarded');
    expect(discardEvent?.payload).toMatchObject({
      dlqEntryId,
      originQueue: 'probe',
      originalJobId: `${videoId}--probe--g1`,
    });
  });
});

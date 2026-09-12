import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters';
import { mintDevToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import { QUEUES, ids } from '@vp/job-contracts';
import type { FastifyInstance } from 'fastify';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('apps/api Admin DLQ & Reprocess Endpoints (Ticket 16: AC 4, 5)', () => {
  let app: FastifyInstance;
  const repositories = new InMemoryRepositories();
  const queuesMap = new Map<string, InMemoryJobQueue>();

  const ADMIN_USER_ID = '00000000-0000-7000-8000-000000000003';
  const OWNER_USER_ID = '00000000-0000-7000-8000-000000000001';
  const OTHER_USER_ID = '00000000-0000-7000-8000-000000000002';
  const VALID_ADMIN_TOKEN = 'change-me-32-bytes-random';

  let adminJwt: string;
  let ownerJwt: string;
  let otherJwt: string;

  let probeQueue: InMemoryJobQueue;

  beforeAll(async () => {
    process.env.ADMIN_TOKEN = VALID_ADMIN_TOKEN;

    for (const qName of QUEUES) {
      const q = new InMemoryJobQueue(qName);
      queuesMap.set(qName, q);
    }
    const q = queuesMap.get('probe');
    if (!q) throw new Error('probe queue missing');
    probeQueue = q;

    app = await buildApp({
      repositories,
      adminQueues: new Map(queuesMap),
      jobQueue: probeQueue,
    });
    await app.ready();

    adminJwt = mintDevToken({
      sub: ADMIN_USER_ID,
      role: 'admin',
      ttl: '1h',
    });

    ownerJwt = mintDevToken({
      sub: OWNER_USER_ID,
      role: 'user',
      ttl: '1h',
    });

    otherJwt = mintDevToken({
      sub: OTHER_USER_ID,
      role: 'user',
      ttl: '1h',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // AC 4: GET /admin/dlq
  describe('GET /admin/dlq (AC 4)', () => {
    beforeAll(async () => {
      // Seed DLQ entries
      for (let i = 1; i <= 5; i++) {
        await repositories.dlq.create({
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

    it('rejects unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/dlq',
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects non-admin users with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/dlq',
        headers: {
          authorization: `Bearer ${otherJwt}`,
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('allows admin via Bearer JWT and lists entries', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/dlq',
        headers: {
          authorization: `Bearer ${adminJwt}`,
        },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.items.length).toBeGreaterThanOrEqual(5);
    });

    it('allows admin via x-admin-token header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/dlq',
        headers: {
          'x-admin-token': VALID_ADMIN_TOKEN,
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it('supports pagination with limit and cursor', async () => {
      const firstPage = await app.inject({
        method: 'GET',
        url: '/admin/dlq?limit=2',
        headers: {
          authorization: `Bearer ${adminJwt}`,
        },
      });
      expect(firstPage.statusCode).toBe(200);
      const page1 = firstPage.json();
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).toBeDefined();

      const secondPage = await app.inject({
        method: 'GET',
        url: `/admin/dlq?limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`,
        headers: {
          authorization: `Bearer ${adminJwt}`,
        },
      });
      expect(secondPage.statusCode).toBe(200);
      const page2 = secondPage.json();
      expect(page2.items).toHaveLength(2);
      expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
    });

    it('supports filtering by status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/dlq?status=REPLAYED',
        headers: {
          authorization: `Bearer ${adminJwt}`,
        },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.items.length).toBeGreaterThanOrEqual(1);
      expect(data.items.every((i: { status: string }) => i.status === 'REPLAYED')).toBe(true);
    });
  });

  // AC 4: POST /admin/dlq/:id/replay
  describe('POST /admin/dlq/:id/replay (AC 4)', () => {
    let dlqEntryId: string;
    const videoId = '018f0000-0000-7000-8000-000000000010';

    beforeAll(async () => {
      const entry = await repositories.dlq.create({
        id: uuidv7(),
        queue: 'transcode-720p',
        jobId: `${videoId}--transcode--720p--g1`,
        videoId,
        errorCode: 'FFMPEG_FAILED',
        errorMessage: 'FFmpeg transcode failed',
        attemptsMade: 4,
        payload: { videoId, rendition: { name: '720p' }, generation: 1 },
        status: 'PARKED',
      });
      dlqEntryId = entry.id;
    });

    it('requires admin access', async () => {
      const unauth = await app.inject({
        method: 'POST',
        url: `/admin/dlq/${dlqEntryId}/replay`,
      });
      expect(unauth.statusCode).toBe(401);

      const forbidden = await app.inject({
        method: 'POST',
        url: `/admin/dlq/${dlqEntryId}/replay`,
        headers: { authorization: `Bearer ${ownerJwt}` },
      });
      expect(forbidden.statusCode).toBe(403);
    });

    it('returns 404 for nonexistent DLQ entry', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/dlq/nonexistent-id/replay',
        headers: { authorization: `Bearer ${adminJwt}` },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe(ErrorCodes.DLQ_ENTRY_NOT_FOUND);
    });

    it('re-adds job to origin queue with --r1, updates status to REPLAYED, writes audit event', async () => {
      const targetQueue = queuesMap.get('transcode-720p');
      expect(targetQueue).toBeDefined();
      if (!targetQueue) return;
      targetQueue.enqueuedJobs.length = 0;

      const res = await app.inject({
        method: 'POST',
        url: `/admin/dlq/${dlqEntryId}/replay`,
        headers: { authorization: `Bearer ${adminJwt}` },
      });

      expect(res.statusCode).toBe(202);
      const data = res.json();
      expect(data.status).toBe('REPLAYED');
      expect(data.dlqEntryId).toBe(dlqEntryId);
      expect(data.replayJobId).toBe(`${videoId}--transcode--720p--g1--r1`);

      // Verify job re-enqueued to transcode-720p queue
      expect(targetQueue.enqueuedJobs).toHaveLength(1);
      expect(targetQueue.enqueuedJobs[0]?.id).toBe(`${videoId}--transcode--720p--g1--r1`);

      // Verify DLQ status updated
      const updated = await repositories.dlq.findById(dlqEntryId);
      expect(updated?.status).toBe('REPLAYED');
      expect(updated?.replayedAt).toBeDefined();

      // Verify audit event dlq.replayed written to video_events
      const events = await repositories.events.findByVideoId(videoId);
      const replayEvent = events.find((e) => e.type === 'dlq.replayed');
      expect(replayEvent).toBeDefined();
      expect(replayEvent?.payload).toMatchObject({
        dlqEntryId,
        originQueue: 'transcode-720p',
        originalJobId: `${videoId}--transcode--720p--g1`,
        replayJobId: `${videoId}--transcode--720p--g1--r1`,
      });
    });
  });

  // AC 4: DELETE /admin/dlq/:id (Discard)
  describe('DELETE /admin/dlq/:id (AC 4)', () => {
    let dlqEntryId: string;
    const videoId = '018f0000-0000-7000-8000-000000000020';

    beforeAll(async () => {
      const entry = await repositories.dlq.create({
        id: uuidv7(),
        queue: 'probe',
        jobId: `${videoId}--probe--g1`,
        videoId,
        errorCode: 'CORRUPT_CONTAINER',
        errorMessage: 'File contains corrupted moov atom',
        attemptsMade: 1,
        payload: { videoId, sourceKey: 'raw/corrupt.mp4' },
        status: 'PARKED',
      });
      dlqEntryId = entry.id;
    });

    it('requires admin access', async () => {
      const unauth = await app.inject({
        method: 'DELETE',
        url: `/admin/dlq/${dlqEntryId}`,
      });
      expect(unauth.statusCode).toBe(401);

      const forbidden = await app.inject({
        method: 'DELETE',
        url: `/admin/dlq/${dlqEntryId}`,
        headers: { authorization: `Bearer ${ownerJwt}` },
      });
      expect(forbidden.statusCode).toBe(403);
    });

    it('returns 404 for nonexistent DLQ entry', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/admin/dlq/nonexistent-id',
        headers: { authorization: `Bearer ${adminJwt}` },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe(ErrorCodes.DLQ_ENTRY_NOT_FOUND);
    });

    it('marks entry DISCARDED and writes dlq.discarded audit event', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/dlq/${dlqEntryId}`,
        headers: { authorization: `Bearer ${adminJwt}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify DLQ status updated to DISCARDED
      const updated = await repositories.dlq.findById(dlqEntryId);
      expect(updated?.status).toBe('DISCARDED');

      // Verify dlq.discarded event written
      const events = await repositories.events.findByVideoId(videoId);
      const discardEvent = events.find((e) => e.type === 'dlq.discarded');
      expect(discardEvent).toBeDefined();
      expect(discardEvent?.payload).toMatchObject({
        dlqEntryId,
        originQueue: 'probe',
        originalJobId: `${videoId}--probe--g1`,
      });
    });
  });

  // AC 5: POST /videos/:id/reprocess
  describe('POST /videos/:id/reprocess (AC 5)', () => {
    const videoId = '018f0000-0000-7000-8000-000000000030';
    const otherVideoId = '018f0000-0000-7000-8000-000000000031';

    beforeAll(async () => {
      await repositories.videos.create({
        id: videoId,
        ownerId: OWNER_USER_ID,
        title: 'Reprocess Test Video',
        status: 'FAILED',
        sourceKey: `raw/${videoId}/source.mp4`,
        generation: 1,
      });

      await repositories.videos.create({
        id: otherVideoId,
        ownerId: OTHER_USER_ID,
        title: 'Other User Video',
        status: 'READY',
        sourceKey: `raw/${otherVideoId}/source.mp4`,
        generation: 1,
      });
    });

    it('rejects unauthenticated request with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/videos/${videoId}/reprocess`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects non-owner non-admin with 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/videos/${videoId}/reprocess`,
        headers: { authorization: `Bearer ${otherJwt}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('returns 404 for nonexistent video', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/videos/018f0000-0000-7000-8000-000000000999/reprocess',
        headers: { authorization: `Bearer ${adminJwt}` },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
    });

    it('owner can reprocess: bumps generation, transitions to PROBING, enqueues probe job', async () => {
      probeQueue.enqueuedJobs.length = 0;

      const res = await app.inject({
        method: 'POST',
        url: `/videos/${videoId}/reprocess`,
        headers: { authorization: `Bearer ${ownerJwt}` },
      });

      expect(res.statusCode).toBe(202);
      const data = res.json();
      expect(data.videoId).toBe(videoId);
      expect(data.status).toBe('PROBING');
      expect(data.generation).toBe(2);

      // Verify video record in repository
      const video = await repositories.videos.findById(videoId);
      expect(video?.generation).toBe(2);
      expect(video?.status).toBe('PROBING');

      // Verify probe job enqueued with g2
      expect(probeQueue.enqueuedJobs).toHaveLength(1);
      const job = probeQueue.enqueuedJobs[0];
      expect(job).toBeDefined();
      if (!job) throw new Error('Job is undefined');
      expect(job.id).toBe(ids.probe(videoId, 2));
      expect((job.data as { generation?: number; videoId?: string }).generation).toBe(2);
      expect((job.data as { generation?: number; videoId?: string }).videoId).toBe(videoId);

      // Verify video.reprocessing audit event
      const events = await repositories.events.findByVideoId(videoId);
      const reprocessEvent = events.find((e) => e.type === 'video.reprocessing');
      expect(reprocessEvent).toBeDefined();
      expect((reprocessEvent?.payload as { generation?: number })?.generation).toBe(2);
    });

    it('admin can reprocess any video', async () => {
      probeQueue.enqueuedJobs.length = 0;

      const res = await app.inject({
        method: 'POST',
        url: `/videos/${otherVideoId}/reprocess`,
        headers: { authorization: `Bearer ${adminJwt}` },
      });

      expect(res.statusCode).toBe(202);
      const data = res.json();
      expect(data.videoId).toBe(otherVideoId);
      expect(data.generation).toBe(2);
      expect(data.status).toBe('PROBING');
    });

    it('owner rate limit enforces max 5 requests per minute, whereas admin is exempt', async () => {
      const rateLimitVideoId = '018f0000-0000-7000-8000-000000000040';
      await repositories.videos.create({
        id: rateLimitVideoId,
        ownerId: OWNER_USER_ID,
        title: 'Rate Limit Test Video',
        status: 'READY',
        sourceKey: `raw/${rateLimitVideoId}/source.mp4`,
        generation: 1,
      });

      // Owner already made 1 reprocess call above. Send 4 more to hit limit of 5.
      for (let i = 0; i < 4; i++) {
        // Reset status to READY to allow reprocess
        await repositories.videos.transition({
          videoId: rateLimitVideoId,
          from: ['PROBING', 'READY'],
          to: 'READY',
          eventType: 'test.reset',
        });
        const res = await app.inject({
          method: 'POST',
          url: `/videos/${rateLimitVideoId}/reprocess`,
          headers: { authorization: `Bearer ${ownerJwt}` },
        });
        expect(res.statusCode).toBe(202);
      }

      // 6th call from owner should be rate-limited (429)
      await repositories.videos.transition({
        videoId: rateLimitVideoId,
        from: ['PROBING', 'READY'],
        to: 'READY',
        eventType: 'test.reset',
      });
      const limitedRes = await app.inject({
        method: 'POST',
        url: `/videos/${rateLimitVideoId}/reprocess`,
        headers: { authorization: `Bearer ${ownerJwt}` },
      });
      expect(limitedRes.statusCode).toBe(429);
      expect(limitedRes.json().code).toBe(ErrorCodes.RATE_LIMITED);

      // Admin calling reprocess should succeed (admin exempt from rate limit)
      const adminRes = await app.inject({
        method: 'POST',
        url: `/videos/${rateLimitVideoId}/reprocess`,
        headers: { authorization: `Bearer ${adminJwt}` },
      });
      expect(adminRes.statusCode).toBe(202);
    });
  });
});

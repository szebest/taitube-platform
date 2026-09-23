import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters';
import { mintDevToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import { QUEUES } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { HOUSEKEEPING_SCHEDULER_CONFIGS } from '../services/housekeeping-schedulers';

describe('apps/api Housekeeping Schedulers & Video Deletion (Ticket 17: AC 1, AC 4)', () => {
  let app: FastifyInstance;
  const repositories = new InMemoryRepositories();
  const queuesMap = new Map<string, InMemoryJobQueue>();

  const ADMIN_USER_ID = '00000000-0000-7000-8000-000000000003';
  const OWNER_USER_ID = '00000000-0000-7000-8000-000000000001';
  const OTHER_USER_ID = '00000000-0000-7000-8000-000000000002';

  let adminJwt: string;
  let ownerJwt: string;
  let otherJwt: string;
  let housekeepingQueue: InMemoryJobQueue;

  beforeAll(async () => {
    for (const qName of QUEUES) {
      const q = new InMemoryJobQueue(qName);
      queuesMap.set(qName, q);
    }
    const hkQ = queuesMap.get('housekeeping');
    if (!hkQ) throw new Error('housekeeping queue missing');
    housekeepingQueue = hkQ;

    app = await buildApp({
      adapters: {
        repositories,
        queues: queuesMap,
      },
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

  describe('AC 1: Schedulers exist with ids/crons from SDD §9.8 & idempotent boot', () => {
    it('initializes housekeeping schedulers with exact ids and crons from SDD §9.8', async () => {
      const schedulers = await housekeepingQueue.getJobSchedulers();
      expect(schedulers).toHaveLength(6);

      const map = new Map(expectOk(schedulers).map((s) => [s.id, s]));

      expect(map.get('reconcile-uploads')?.pattern).toBe('*/15 * * * *');
      expect(map.get('reconcile-processing')?.pattern).toBe('*/10 * * * *');
      expect(map.get('purge-deleted')?.pattern).toBe('0 * * * *');
      expect(map.get('expire-raw')?.pattern).toBe('30 3 * * *');
      expect(map.get('tmp-sweep')?.pattern).toBe('*/30 * * * *');
      expect(map.get('reconcile-reaction-counters')?.pattern).toBe('0 * * * *');
    });

    it.each(HOUSEKEEPING_SCHEDULER_CONFIGS)(
      'scheduler "$id" carries task payload matching its id',
      async ({ id }) => {
        const schedulers = await housekeepingQueue.getJobSchedulers();
        const map = new Map(expectOk(schedulers).map((s) => [s.id, s]));
        const item = map.get(id);
        expect(item).toBeDefined();
        expect((item?.data as { task: string })?.task).toBe(id);
      }
    );

    it('restarting the API twice leaves exactly one of each scheduler', async () => {
      // Boot a second API instance on the same queues
      const secondApp = await buildApp({
        adapters: {
          repositories,
          queues: queuesMap,
        },
      });
      await secondApp.ready();

      const schedulers = await housekeepingQueue.getJobSchedulers();
      expect(schedulers).toHaveLength(6);

      const ids = expectOk(schedulers)
        .map((s) => s.id)
        .sort();
      expect(ids).toEqual([
        'expire-raw',
        'purge-deleted',
        'reconcile-processing',
        'reconcile-reaction-counters',
        'reconcile-uploads',
        'tmp-sweep',
      ]);

      await secondApp.close();
    });
  });

  describe('AC 4: DELETE /videos/:id and /v1/videos/:id soft delete', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/videos/${uuidv7()}`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 404 if video does not exist', async () => {
      const nonExistentId = uuidv7();
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/videos/${nonExistentId}`,
        headers: {
          authorization: `Bearer ${ownerJwt}`,
        },
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
    });

    it('rejects deletion by a non-owner user with 403', async () => {
      const videoId = uuidv7();
      await repositories.videos.create({
        id: videoId,
        ownerId: OWNER_USER_ID,
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'READY',
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/videos/${videoId}`,
        headers: {
          authorization: `Bearer ${otherJwt}`,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('allows owner to soft delete video via DELETE /v1/videos/:id', async () => {
      const videoId = uuidv7();
      await repositories.videos.create({
        id: videoId,
        ownerId: OWNER_USER_ID,
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'READY',
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/videos/${videoId}`,
        headers: {
          authorization: `Bearer ${ownerJwt}`,
        },
      });

      expect(res.statusCode).toBe(202);
      const body = JSON.parse(res.body);
      expect(body).toEqual({
        videoId,
        status: 'DELETED',
      });

      const video = expectOk(await repositories.videos.findById(videoId));
      expect(video?.status).toBe('DELETED');
      expect((video as unknown as { deletedAt?: Date })?.deletedAt).toBeDefined();

      const events = await repositories.events.findByVideoId(videoId);
      expect(expectOk(events).some((e) => e.type === 'video.deleted')).toBe(true);
    });

    it('allows soft delete via alternative path /videos/:id', async () => {
      const videoId = uuidv7();
      await repositories.videos.create({
        id: videoId,
        ownerId: OWNER_USER_ID,
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'PROCESSING',
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/videos/${videoId}`,
        headers: {
          authorization: `Bearer ${ownerJwt}`,
        },
      });

      expect(res.statusCode).toBe(202);
      const video = expectOk(await repositories.videos.findById(videoId));
      expect(video?.status).toBe('DELETED');
    });

    it('returns 202 idempotently if video is already DELETED', async () => {
      const videoId = uuidv7();
      await repositories.videos.create({
        id: videoId,
        ownerId: OWNER_USER_ID,
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'READY',
      });

      // First delete
      const res1 = await app.inject({
        method: 'DELETE',
        url: `/v1/videos/${videoId}`,
        headers: {
          authorization: `Bearer ${ownerJwt}`,
        },
      });
      expect(res1.statusCode).toBe(202);

      // Second delete
      const res2 = await app.inject({
        method: 'DELETE',
        url: `/v1/videos/${videoId}`,
        headers: {
          authorization: `Bearer ${ownerJwt}`,
        },
      });
      expect(res2.statusCode).toBe(202);
      expect(JSON.parse(res2.body)).toEqual({
        videoId,
        status: 'DELETED',
      });
    });

    it('allows admin to soft delete any user video', async () => {
      const videoId = uuidv7();
      await repositories.videos.create({
        id: videoId,
        ownerId: OWNER_USER_ID,
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'FAILED',
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/videos/${videoId}`,
        headers: {
          authorization: `Bearer ${adminJwt}`,
        },
      });

      expect(res.statusCode).toBe(202);
      const video = expectOk(await repositories.videos.findById(videoId));
      expect(video?.status).toBe('DELETED');
    });
  });
});

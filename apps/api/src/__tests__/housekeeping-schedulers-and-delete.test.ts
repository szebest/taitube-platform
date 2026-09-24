import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { QUEUES } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { uuidv7 } from 'uuidv7';
import { composeApp } from '../app';
import { bearer } from './in-memory-app';

describe('housekeeping schedulers and video deletion', () => {
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

    const composed = await composeApp({
      config: inProcessAppConfig(),
      adapters: { repositories, queues: queuesMap },
    });
    expectOk(await composed.container.start());
    app = composed.app;
    await app.ready();

    adminJwt = mintToken({ sub: ADMIN_USER_ID, role: 'admin', ttl: '1h' });
    ownerJwt = mintToken({ sub: OWNER_USER_ID, role: 'user', ttl: '1h' });
    otherJwt = mintToken({ sub: OTHER_USER_ID, role: 'user', ttl: '1h' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('housekeeping schedulers (SDD §9.8)', () => {
    it('initializes housekeeping schedulers with exact ids and crons from SDD §9.8', async () => {
      const schedulers = expectOk(await housekeepingQueue.getJobSchedulers());
      expect(schedulers).toHaveLength(6);

      const map = new Map(schedulers.map((s) => [s.id, s]));

      expect(map.get('reconcile-uploads')?.pattern).toBe('*/15 * * * *');
      expect(map.get('reconcile-processing')?.pattern).toBe('*/10 * * * *');
      expect(map.get('purge-deleted')?.pattern).toBe('0 * * * *');
      expect(map.get('expire-raw')?.pattern).toBe('30 3 * * *');
      expect(map.get('tmp-sweep')?.pattern).toBe('*/30 * * * *');
      expect(map.get('reconcile-reaction-counters')?.pattern).toBe('0 * * * *');
    });

    it.each([
      'reconcile-uploads',
      'reconcile-processing',
      'purge-deleted',
      'expire-raw',
      'tmp-sweep',
      'reconcile-reaction-counters',
    ])('scheduler "%s" carries task payload matching its id', async (id) => {
      const schedulers = expectOk(await housekeepingQueue.getJobSchedulers());
      const map = new Map(schedulers.map((s) => [s.id, s]));
      const item = map.get(id);
      expect(item).toBeDefined();
      expect((item?.data as { task: string })?.task).toBe(id);
    });

    it('restarting the API twice leaves exactly one of each scheduler', async () => {
      const second = await composeApp({
        config: inProcessAppConfig(),
        adapters: { repositories, queues: queuesMap },
      });
      expectOk(await second.container.start());
      const secondApp = second.app;

      const schedulers = expectOk(await housekeepingQueue.getJobSchedulers());
      expect(schedulers).toHaveLength(6);

      const ids = schedulers.map((s) => s.id).sort();
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

  describe('DELETE /v1/videos/:id soft delete', () => {
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
        headers: bearer(ownerJwt),
      });
      expect(res.statusCode).toBe(404);
      const body = res.json();
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
        headers: bearer(otherJwt),
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
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
        headers: bearer(ownerJwt),
      });

      expect(res.statusCode).toBe(202);
      const body = res.json();
      expect(body).toEqual({
        videoId,
        status: 'DELETED',
      });

      const video = expectOk(await repositories.videos.findById(videoId));
      expect(video?.status).toBe('DELETED');
      expect(video?.deletedAt).toBeInstanceOf(Date);

      const events = expectOk(await repositories.events.findByVideoId(videoId));
      expect(events.some((e) => e.type === 'video.deleted')).toBe(true);
    });

    it('returns 202 idempotently if video is already DELETED', async () => {
      const videoId = uuidv7();
      await repositories.videos.create({
        id: videoId,
        ownerId: OWNER_USER_ID,
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'READY',
      });

      const res1 = await app.inject({
        method: 'DELETE',
        url: `/v1/videos/${videoId}`,
        headers: bearer(ownerJwt),
      });
      expect(res1.statusCode).toBe(202);

      const res2 = await app.inject({
        method: 'DELETE',
        url: `/v1/videos/${videoId}`,
        headers: bearer(ownerJwt),
      });
      expect(res2.statusCode).toBe(202);
      expect(res2.json()).toEqual({
        videoId,
        status: 'DELETED',
      });
    });

    it.each([
      {
        name: 'the owner via the /videos/:id alias',
        url: '/videos',
        status: 'PROCESSING',
        token: () => ownerJwt,
      },
      {
        name: 'an admin on any user video',
        url: '/v1/videos',
        status: 'FAILED',
        token: () => adminJwt,
      },
    ] as const)('soft deletes for $name', async ({ url, status, token }) => {
      const videoId = uuidv7();
      await repositories.videos.create({
        id: videoId,
        ownerId: OWNER_USER_ID,
        sourceKey: `raw/${videoId}/source.mp4`,
        status,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `${url}/${videoId}`,
        headers: bearer(token()),
      });

      expect(res.statusCode).toBe(202);
      const video = expectOk(await repositories.videos.findById(videoId));
      expect(video?.status).toBe('DELETED');
    });
  });
});

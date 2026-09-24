import { InMemoryJobQueue, type InMemoryRepositories } from '@vp/adapters/in-memory';
import type { VideoStatus } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { uuidv7 } from 'uuidv7';
import { TOKENS, bearer, buildTestApp, inMemoryQueues } from './test-app';

describe('housekeeping schedulers and video deletion', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  const housekeepingQueue = new InMemoryJobQueue('housekeeping');
  const queues = inMemoryQueues(housekeepingQueue);

  async function ownedVideo(status: VideoStatus = 'READY'): Promise<string> {
    const videoId = uuidv7();
    await repositories.videos.create({
      id: videoId,
      ownerId: SEEDED.userId,
      sourceKey: `raw/${videoId}/source.mp4`,
      status,
    });
    return videoId;
  }

  function deleteVideo(videoId: string, token?: string, url = '/v1/videos') {
    return app.inject({
      method: 'DELETE',
      url: `${url}/${videoId}`,
      headers: token ? bearer(token) : {},
    });
  }

  beforeAll(async () => {
    const testApp = await buildTestApp({ adapters: { queues } });
    expectOk(await testApp.container.start());
    ({ app, repositories } = testApp);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('housekeeping schedulers (SDD §9.8)', () => {
    it.each([
      { id: 'reconcile-uploads', pattern: '*/15 * * * *' },
      { id: 'reconcile-processing', pattern: '*/10 * * * *' },
      { id: 'purge-deleted', pattern: '0 * * * *' },
      { id: 'expire-raw', pattern: '30 3 * * *' },
      { id: 'tmp-sweep', pattern: '*/30 * * * *' },
      { id: 'reconcile-reaction-counters', pattern: '0 * * * *' },
    ])('schedules $id on $pattern with a task of the same name', async ({ id, pattern }) => {
      const schedulers = expectOk(await housekeepingQueue.getJobSchedulers());
      const scheduler = schedulers.find((candidate) => candidate.id === id);

      expect(scheduler?.pattern).toBe(pattern);
      expect(scheduler?.data).toMatchObject({ task: id });
    });

    it('restarting the API twice leaves exactly one of each scheduler', async () => {
      const second = await buildTestApp({ adapters: { repositories, queues } });
      expectOk(await second.container.start());

      const schedulers = expectOk(await housekeepingQueue.getJobSchedulers());
      expect(schedulers.map((s) => s.id).sort()).toEqual([
        'expire-raw',
        'purge-deleted',
        'reconcile-processing',
        'reconcile-reaction-counters',
        'reconcile-uploads',
        'tmp-sweep',
      ]);

      await second.app.close();
    });
  });

  describe('DELETE /v1/videos/:id soft delete', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await deleteVideo(uuidv7());
      expect(res.statusCode).toBe(401);
    });

    it('returns 404 if video does not exist', async () => {
      const res = await deleteVideo(uuidv7(), TOKENS.user);

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
    });

    it('rejects deletion by a non-owner user with 403', async () => {
      const res = await deleteVideo(await ownedVideo(), TOKENS.otherUser);

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('allows owner to soft delete video via DELETE /v1/videos/:id', async () => {
      const videoId = await ownedVideo();

      const res = await deleteVideo(videoId, TOKENS.user);

      expect(res.statusCode).toBe(202);
      expect(res.json()).toEqual({ videoId, status: 'DELETED' });
      const video = expectOk(await repositories.videos.findById(videoId));
      expect(video?.status).toBe('DELETED');
      expect(video?.deletedAt).toBeInstanceOf(Date);
      const events = expectOk(await repositories.events.findByVideoId(videoId));
      expect(events.some((e) => e.type === 'video.deleted')).toBe(true);
    });

    it('returns 202 idempotently if video is already DELETED', async () => {
      const videoId = await ownedVideo();

      const first = await deleteVideo(videoId, TOKENS.user);
      const second = await deleteVideo(videoId, TOKENS.user);

      expect(first.statusCode).toBe(202);
      expect(second.statusCode).toBe(202);
      expect(second.json()).toEqual({ videoId, status: 'DELETED' });
    });

    it.each([
      {
        name: 'the owner via the /videos/:id alias',
        url: '/videos',
        status: 'PROCESSING',
        token: TOKENS.user,
      },
      {
        name: 'an admin on any user video',
        url: '/v1/videos',
        status: 'FAILED',
        token: TOKENS.admin,
      },
    ] as const)('soft deletes for $name', async ({ url, status, token }) => {
      const videoId = await ownedVideo(status);

      const res = await deleteVideo(videoId, token, url);

      expect(res.statusCode).toBe(202);
      const video = expectOk(await repositories.videos.findById(videoId));
      expect(video?.status).toBe('DELETED');
    });
  });
});

import type { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { expectOk } from '@vp/testing/result';
import { ADMIN_TOKEN, buildTestApp, seedVideo } from '../../__tests__/test-app';

const OWNER = '00000000-0000-7000-8000-00000000b0a1';
const PICKED = '00000000-0000-7000-8000-00000000b0b1';
const TRENDING = '00000000-0000-7000-8000-00000000b0b2';
const HOUR = 3_600_000;

describe('pick routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  let now: number;
  const admin = { 'x-admin-token': ADMIN_TOKEN };

  const current = (headers: Record<string, string> = {}) =>
    app.inject({ method: 'GET', url: '/v1/picks/current', headers });

  const schedule = (startsAt: number, endsAt: number, note: string | null = 'Worth it') =>
    app.inject({
      method: 'POST',
      url: '/v1/admin/picks',
      headers: admin,
      payload: {
        videoId: PICKED,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        note,
      },
    });

  beforeAll(async () => {
    ({ app, repositories, cache } = await buildTestApp({
      config: inProcessAppConfig({ auth: { adminToken: ADMIN_TOKEN } }),
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    now = Date.now();
    repositories.clear();
    cache.clear();
    await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' });
    await seedVideo(repositories, { id: PICKED, ownerId: OWNER, title: 'Picked' });
    await seedVideo(repositories, { id: TRENDING, ownerId: OWNER, title: 'Trending' });
  });

  describe('GET /v1/picks/current', () => {
    it('serves the scheduled pick to an anonymous caller, cached until it ends', async () => {
      expect((await schedule(now - HOUR, now + 14 * HOUR)).statusCode).toBe(201);

      const res = await current();

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        source: 'scheduled',
        note: 'Worth it',
        endsAt: new Date(now + 14 * HOUR).toISOString(),
        video: { id: PICKED, channel: { handle: 'owner' } },
      });
      expect(res.headers['cache-control']).toContain('public');
    });

    it('answers a fallback without a note or a window when nothing is scheduled', async () => {
      const res = await current();

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        source: 'fallback',
        note: null,
        startsAt: null,
        endsAt: null,
      });
    });

    it('gives way to the fallback once the window has ended', async () => {
      expectOk(
        await repositories.picks.create({
          id: '00000000-0000-7000-8000-00000000b0c1',
          videoId: PICKED,
          startsAt: new Date(now - 2 * HOUR),
          endsAt: new Date(now - 1),
          note: 'Yesterday',
          createdBy: OWNER,
          createdAt: new Date(now - 3 * HOUR),
        })
      );

      expect((await current()).json().source).toBe('fallback');
    });

    it('answers 304 to a client that holds the current etag', async () => {
      await schedule(now - HOUR, now + 14 * HOUR);
      const first = await current();

      const again = await current({ 'if-none-match': String(first.headers.etag) });

      expect(again.statusCode).toBe(304);
    });

    it('answers 404 when nothing is scheduled and no video is trending', async () => {
      repositories.clear();

      const res = await current();

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
    });
  });
});

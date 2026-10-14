import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp, seedVideo } from '../../__tests__/test-app';

const PUBLIC_VIDEO = '33333333-3333-7333-8333-333333333331';
const PRIVATE_VIDEO = '33333333-3333-7333-8333-333333333332';
const ABSENT_VIDEO = '99999999-9999-7999-8999-999999999999';

describe('analytics routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  const get = (url: string, token?: string) =>
    app.inject({ method: 'GET', url, headers: token ? bearer(token) : {} });

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
    await seedVideo(repositories, { id: PUBLIC_VIDEO, ownerId: SEEDED.userId, title: 'Open' });
    await seedVideo(repositories, {
      id: PRIVATE_VIDEO,
      ownerId: SEEDED.userId,
      title: 'Closed',
      visibility: 'private',
    });
    const today = new Date().toISOString().slice(0, 10);
    expectOk(
      await repositories.videoViews.applyBatch({
        batchId: 'seed',
        counts: [{ videoId: PUBLIC_VIDEO, viewDate: today, views: 5, watchSeconds: 50 }],
      })
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves the owner's video analytics for the requested range", async () => {
    const res = await get(`/v1/creator/videos/${PUBLIC_VIDEO}/analytics?range=7d`, TOKENS.user);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ videoId: PUBLIC_VIDEO, range: '7d', rangeViews: 5 });
    expect(res.json().timeline).toHaveLength(7);
  });

  it("serves the caller's channel analytics over the default range", async () => {
    const res = await get('/v1/creator/channel/analytics', TOKENS.user);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ range: '30d', totalViews: 5, videoCount: 2 });
    expect(res.json().topVideos).toEqual([
      { videoId: PUBLIC_VIDEO, title: 'Open', views: 5, totalViews: 5 },
    ]);
  });

  it.each([`/v1/creator/videos/${PUBLIC_VIDEO}/analytics`, '/v1/creator/channel/analytics'])(
    'refuses an anonymous GET %s with 401',
    async (url) => {
      const res = await get(url);

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
    }
  );

  it.each([
    { scenario: 'a public video they do not own', videoId: PUBLIC_VIDEO, status: 403 },
    { scenario: 'a private video they cannot see', videoId: PRIVATE_VIDEO, status: 404 },
    { scenario: 'an absent video', videoId: ABSENT_VIDEO, status: 404 },
  ])('answers a stranger asking about $scenario with $status', async ({ videoId, status }) => {
    const res = await get(`/v1/creator/videos/${videoId}/analytics`, TOKENS.otherUser);

    expect(res.statusCode).toBe(status);
  });

  it('refuses a range outside the three offered with 400', async () => {
    const res = await get('/v1/creator/channel/analytics?range=365d', TOKENS.user);

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});

import { inProcessAppConfig } from '@vp/env-schema';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { FastifyInstance } from 'fastify';
import { composeApp } from '../../app';

const OWNER = '00000000-0000-7000-8000-000000000001';
const PUBLIC_VIDEO = '018f0000-0000-7000-8000-000000000001';
const PRIVATE_VIDEO = '018f0000-0000-7000-8000-000000000002';
const CACHE_CONTROL = 'public, max-age=30, stale-while-revalidate=60';

describe('public feed route', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const repositories = new InMemoryRepositories();
    for (const [id, visibility] of [
      [PUBLIC_VIDEO, 'public'],
      [PRIVATE_VIDEO, 'private'],
    ] as const) {
      await repositories.videos.create({
        id,
        ownerId: OWNER,
        title: `${visibility} video`,
        visibility,
        status: 'READY',
        sourceKey: `raw/${id}/source.mp4`,
      });
    }
    app = (await composeApp({ config: inProcessAppConfig(), adapters: { repositories } })).app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['/v1/feed', '/feed'])(
    'serves only public videos anonymously on %s with an ETag and Cache-Control',
    async (url) => {
      const res = await app.inject({ method: 'GET', url });

      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe(CACHE_CONTROL);
      expect(res.headers.etag).toMatch(/^W\/"[a-f0-9]+"/);
      expect(res.json().items.map((video: { id: string }) => video.id)).toEqual([PUBLIC_VIDEO]);
    }
  );

  it('answers 304 with an empty body when the ETag still matches', async () => {
    const first = await app.inject({ method: 'GET', url: '/v1/feed' });
    const etag = first.headers.etag as string;

    const res = await app.inject({
      method: 'GET',
      url: '/v1/feed',
      headers: { 'if-none-match': etag },
    });

    expect(res.statusCode).toBe(304);
    expect(res.body).toBe('');
    expect(res.headers.etag).toBe(etag);
    expect(res.headers['cache-control']).toBe(CACHE_CONTROL);
  });

  it('answers 400 on a category filter that is not a UUID', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/feed?categoryId=music' });

    expect(res.statusCode).toBe(400);
  });
});

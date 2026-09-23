import { inProcessAppConfig } from '@vp/env-schema';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

const CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=60';

describe('public category routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  beforeAll(async () => {
    repositories = new InMemoryRepositories();
    await repositories.categories.create({ name: 'Music', slug: 'music', sortOrder: 1 });
    await repositories.categories.create({
      name: 'Hidden',
      slug: 'hidden',
      sortOrder: 0,
      isActive: false,
    });
    app = await buildApp({ config: inProcessAppConfig(), adapters: { repositories } });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['/v1/categories', '/categories'])(
    'serves only active categories anonymously on %s with an ETag and Cache-Control',
    async (url) => {
      const res = await app.inject({ method: 'GET', url });

      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe(CACHE_CONTROL);
      expect(res.headers.etag).toMatch(/^W\/"[a-f0-9]{16}"$/);
      expect(res.json().map((category: { slug: string }) => category.slug)).toEqual(['music']);
    }
  );

  it('answers 304 with an empty body when the ETag still matches', async () => {
    const first = await app.inject({ method: 'GET', url: '/v1/categories' });
    const etag = first.headers.etag as string;

    const res = await app.inject({
      method: 'GET',
      url: '/v1/categories',
      headers: { 'if-none-match': etag },
    });

    expect(res.statusCode).toBe(304);
    expect(res.body).toBe('');
    expect(res.headers.etag).toBe(etag);
    expect(res.headers['cache-control']).toBe(CACHE_CONTROL);
  });

  it('answers 200 with the list when the ETag is stale', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/categories',
      headers: { 'if-none-match': 'W/"0000000000000000"' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});

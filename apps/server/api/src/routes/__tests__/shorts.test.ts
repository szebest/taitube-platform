import type { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, seedVideo } from '../../__tests__/test-app';

function videoId(n: number): string {
  return `018f0000-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
}

interface ShortsPage {
  items: { id: string; format: string }[];
  nextCursor: string | null;
  total: number;
}

describe('GET /v1/shorts', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;

  beforeAll(async () => {
    ({ app, repositories, cache } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
    cache.clear();
  });

  const shorts = async (query: string): Promise<ShortsPage> => {
    const res = await app.inject({ method: 'GET', url: `/v1/shorts${query}` });
    expect(res.statusCode).toBe(200);
    return res.json();
  };

  it('serves only the public ready Shorts, anonymously', async () => {
    await seedVideo(repositories, { id: videoId(1), ownerId: SEEDED.userId, format: 'short' });
    await seedVideo(repositories, { id: videoId(2), ownerId: SEEDED.userId });
    await seedVideo(repositories, {
      id: videoId(3),
      ownerId: SEEDED.userId,
      format: 'short',
      visibility: 'private',
    });
    await seedVideo(repositories, {
      id: videoId(4),
      ownerId: SEEDED.userId,
      format: 'short',
      status: 'PROCESSING',
    });

    const page = await shorts('');

    expect(page.items.map((item) => item.id)).toEqual([videoId(1)]);
    expect(page.items[0]?.format).toBe('short');
    expect(page.total).toBe(1);
  });

  it('walks ten Shorts three at a time without showing one twice', async () => {
    for (let n = 1; n <= 10; n += 1) {
      await seedVideo(repositories, {
        id: videoId(n),
        ownerId: SEEDED.userId,
        format: 'short',
        viewsCount: n * 3,
      });
    }

    const served: string[] = [];
    let cursor: string | null = null;
    do {
      const page: ShortsPage = await shorts(`?limit=3${cursor ? `&cursor=${cursor}` : ''}`);
      served.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);

    expect(served).toHaveLength(10);
    expect(new Set(served).size).toBe(10);
  });

  it('refuses a cursor that is not one', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/shorts?cursor=not-a-cursor' });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe(ErrorCodes.INVALID_CURSOR);
  });
});

import type {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemorySearchSuggestionIndex,
} from '@vp/adapters/in-memory';
import { SEARCH_RATE_LIMITS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, seedVideo } from '../../__tests__/test-app';

const CREATOR = '00000000-0000-7000-8000-0000000047e1';
const IDS = {
  channel: '00000000-0000-7000-8000-0000000047c1',
  course: '00000000-0000-7000-8000-0000000047a1',
  shorts: '00000000-0000-7000-8000-0000000047a2',
  secret: '00000000-0000-7000-8000-0000000047a3',
  playlist: '00000000-0000-7000-8000-0000000047b1',
  drafts: '00000000-0000-7000-8000-0000000047b2',
} as const;

interface Item {
  type: string;
  data: { id: string };
}

const kinds = (items: Item[]) => items.map((item) => `${item.type}:${item.data.id}`);

async function seed(repositories: InMemoryRepositories): Promise<void> {
  expectOk(
    await repositories.channels.create({
      id: IDS.channel,
      userId: CREATOR,
      handle: 'fireship',
      displayName: 'Fireship JavaScript',
      subscriberCount: 3000,
    })
  );
  await seedVideo(repositories, {
    id: IDS.course,
    ownerId: CREATOR,
    title: 'Learn JavaScript fast',
    viewsCount: 500,
  });
  await seedVideo(repositories, { id: IDS.shorts, ownerId: CREATOR, title: 'Fireship shorts' });
  await seedVideo(repositories, {
    id: IDS.secret,
    ownerId: SEEDED.userId,
    title: 'Secret JavaScript',
    visibility: 'private',
  });
  expectOk(
    await repositories.playlists.create({
      id: IDS.playlist,
      ownerId: CREATOR,
      title: 'JavaScript playlist',
      description: '',
      visibility: 'public',
    })
  );
  expectOk(
    await repositories.playlists.create({
      id: IDS.drafts,
      ownerId: SEEDED.userId,
      title: 'JavaScript drafts',
      description: '',
      visibility: 'private',
    })
  );
  expectOk(
    await repositories.playlists.addItem(IDS.playlist, {
      id: '00000000-0000-7000-8000-0000000047d1',
      videoId: IDS.course,
    })
  );
}

describe('search routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  let searchSuggestions: InMemorySearchSuggestionIndex;

  const get = (url: string) => app.inject({ method: 'GET', url });

  beforeAll(async () => {
    ({ app, repositories, cache, searchSuggestions } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    repositories.clear();
    cache.clear();
    searchSuggestions.clear();
    await seed(repositories);
  });

  describe('GET /v1/search', () => {
    it('mixes the videos, channels and playlists that share a keyword, nothing private', async () => {
      const res = await get('/v1/search?q=javascript');

      expect(res.statusCode).toBe(200);
      expect(kinds(res.json().items).sort()).toEqual(
        [`channel:${IDS.channel}`, `video:${IDS.course}`, `playlist:${IDS.playlist}`].sort()
      );
      expect(res.json()).toMatchObject({ total: 3, fuzzyFallback: false, nextCursor: null });
      expect(res.json().tookMs).toBeGreaterThanOrEqual(0);
    });

    it.each(['fireship', '@fireship', 'FIRESHIP'])(
      'pins the channel whose handle is %j to the top',
      async (q) => {
        const res = await get(`/v1/search?q=${encodeURIComponent(q)}`);

        expect(kinds(res.json().items)[0]).toBe(`channel:${IDS.channel}`);
        expect(kinds(res.json().items)).toContain(`video:${IDS.shorts}`);
      }
    );

    it.each([
      { type: 'playlist', expected: [`playlist:${IDS.playlist}`] },
      { type: 'channel', expected: [`channel:${IDS.channel}`] },
      { type: 'video', expected: [`video:${IDS.course}`] },
    ])('returns only $type results for type=$type', async ({ type, expected }) => {
      const res = await get(`/v1/search?q=javascript&type=${type}`);

      expect(kinds(res.json().items)).toEqual(expected);
    });

    it('falls back to trigram matches across resources for a typo', async () => {
      const res = await get('/v1/search?q=javascrip');

      expect(res.json().fuzzyFallback).toBe(true);
      expect(kinds(res.json().items).sort()).toEqual(
        [`channel:${IDS.channel}`, `video:${IDS.course}`, `playlist:${IDS.playlist}`].sort()
      );
    });

    it('answers a repeated search from the cache', async () => {
      const first = await get('/v1/search?q=JavaScript');
      const second = await get('/v1/search?q=%20javascript%20');

      expect(first.headers['x-cache']).toBe('MISS');
      expect(second.headers['x-cache']).toBe('HIT');
      expect(second.json().items).toEqual(first.json().items);
    });

    it('walks the results a page at a time and keeps the walk fuzzy', async () => {
      const first = await get('/v1/search?q=javascrip&limit=2');
      const next = await get(
        `/v1/search?q=javascrip&limit=2&cursor=${encodeURIComponent(first.json().nextCursor)}`
      );

      expect(first.json().items).toHaveLength(2);
      expect(next.json()).toMatchObject({ fuzzyFallback: true, nextCursor: null });
      expect([...kinds(first.json().items), ...kinds(next.json().items)]).toHaveLength(3);
    });

    it('refuses a cursor minted under another sort', async () => {
      const first = await get('/v1/search?q=javascript&limit=1');
      const res = await get(
        `/v1/search?q=javascript&sort=date&cursor=${encodeURIComponent(first.json().nextCursor)}`
      );

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe(ErrorCodes.INVALID_CURSOR);
    });

    it('refuses an edited cursor before it reaches the database', async () => {
      const first = await get('/v1/search?q=javascript&limit=1');
      const payload = JSON.parse(
        Buffer.from(first.json().nextCursor, 'base64url').toString('utf8')
      );
      const edited = Buffer.from(JSON.stringify({ ...payload, id: "x' or 1=1" })).toString(
        'base64url'
      );

      const res = await get(`/v1/search?q=javascript&cursor=${edited}`);

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe(ErrorCodes.INVALID_CURSOR);
    });

    it.each([
      { name: 'a blank query', url: '/v1/search?q=%20%20', status: 422 },
      { name: 'a query of exclusions alone', url: '/v1/search?q=-javascript', status: 422 },
      { name: 'a query past 100 characters', url: `/v1/search?q=${'x'.repeat(101)}`, status: 422 },
      { name: 'no query', url: '/v1/search', status: 400 },
      { name: 'a page past 50', url: '/v1/search?q=react&limit=51', status: 400 },
    ])('rejects $name with $status', async ({ url, status }) => {
      const res = await get(url);

      expect(res.statusCode).toBe(status);
      expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
    });
  });

  describe('GET /v1/search/suggestions', () => {
    it('offers matching channels first, then the queries people searched', async () => {
      await get('/v1/search?q=fireship%20shorts');

      const res = await get('/v1/search/suggestions?q=fire');

      expect(res.statusCode).toBe(200);
      expect(res.json().items).toEqual([
        {
          type: 'channel',
          text: 'Fireship JavaScript',
          channelId: IDS.channel,
          handle: 'fireship',
          avatarUrl: null,
        },
        { type: 'query', text: 'fireship shorts' },
      ]);
    });

    it.each([
      { name: 'a query that found nothing', q: 'zzzzzz', prefix: 'zzz' },
      { name: 'a typo the fallback rescued', q: 'javascrip', prefix: 'javas' },
      { name: 'a query built on operators', q: 'javascript -fast', prefix: 'javas' },
    ])('never learns $name', async ({ q, prefix }) => {
      await get(`/v1/search?q=${encodeURIComponent(q)}`);

      const res = await get(`/v1/search/suggestions?q=${prefix}`);

      expect(res.json().items.filter((item: { type: string }) => item.type === 'query')).toEqual(
        []
      );
    });
  });

  describe('rate limits', () => {
    it.each([
      { path: '/v1/search?q=javascript', max: SEARCH_RATE_LIMITS.search },
      { path: '/v1/search/suggestions?q=java', max: SEARCH_RATE_LIMITS.suggestions },
    ])('answers 429 past $max requests a minute on $path', async ({ path, max }) => {
      const limited = await buildTestApp();
      const statuses: number[] = [];
      for (let n = 0; n <= max; n += 1) {
        statuses.push((await limited.app.inject({ method: 'GET', url: path })).statusCode);
      }
      await limited.app.close();

      expect(statuses.slice(0, max).every((status) => status === 200)).toBe(true);
      expect(statuses[max]).toBe(429);
    });
  });
});

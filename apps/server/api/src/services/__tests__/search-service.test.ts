import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemorySearchSuggestionIndex,
} from '@vp/adapters/in-memory';
import { Singleflight } from '@vp/concurrency';
import { SEARCH_CACHE_TTL_SECONDS, SEARCH_SUGGESTIONS } from '@vp/domain';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { inProcessAppConfig } from '@vp/env-schema';
import { cacheUnavailable, databaseUnavailable, ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { HistoryPause } from '../history-pause';
import { type SearchResult, SearchService } from '../search-service';
import { ViewerProgress } from '../viewer-progress';

const OWNER = '00000000-0000-7000-8000-0000000047e1';
const VIDEO = '00000000-0000-7000-8000-0000000047a1';
const CHANNEL = '00000000-0000-7000-8000-0000000047c1';

describe('apps/server/api/services: SearchService', () => {
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  let suggestions: InMemorySearchSuggestionIndex;
  let clock: number;
  let service: SearchService;

  const request = (q: string) =>
    ({ q, type: 'all', sort: 'relevance', limit: 20, record: true }) as const;

  const seedSecondRustVideo = async () =>
    expectOk(
      await repositories.videos.create({
        id: '00000000-0000-7000-8000-0000000047a2',
        ownerId: OWNER,
        title: 'Rust async explained',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/rust2.mp4',
      })
    );

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    cache = new InMemoryCacheClient();
    suggestions = new InMemorySearchSuggestionIndex(Date.now, SEARCH_SUGGESTIONS.keptPerPrefix);
    clock = 1_000;
    service = new SearchService({
      search: repositories.search,
      suggestions,
      cache,
      singleflight: new Singleflight(),
      paginator: new Paginator(),
      viewerProgress: new ViewerProgress(repositories.watchHistory),
      history: repositories.searchHistory,
      pause: new HistoryPause(repositories.userPreferences),
      cdn: inProcessAppConfig().cdn,
      sprite: inProcessAppConfig().sprite,
      channels: repositories.channels,
      now: () => clock,
    });
    expectOk(
      await repositories.videos.create({
        id: VIDEO,
        ownerId: OWNER,
        title: 'Rust ownership explained',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/rust.mp4',
      })
    );
    expectOk(
      await repositories.channels.create({
        id: CHANNEL,
        userId: OWNER,
        handle: 'rustacean',
        displayName: 'Rustacean Station',
      })
    );
  });

  it('runs one repository search for identical concurrent misses', async () => {
    const search = vi.spyOn(repositories.search, 'search');

    const pages = await Promise.all([
      service.search(request('rust')),
      service.search(request('RUST')),
    ]);

    expect(pages.map((page) => expectOk(page).cache)).toEqual(['MISS', 'MISS']);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("puts each video hit under its owner's channel", async () => {
    const { data } = expectOk(await service.search(request('ownership')));

    expect(data.items).toEqual([
      expect.objectContaining({
        type: 'video',
        data: expect.objectContaining({ channel: expect.objectContaining({ id: CHANNEL }) }),
      }),
    ]);
  });

  it('marks a video hit with the caller playhead without leaking it through the shared cache', async () => {
    const viewer = { id: '00000000-0000-7000-8000-0000000000aa', role: 'USER' } as const;
    await repositories.watchHistory.record({
      id: '00000000-0000-7000-8000-0000000000ab',
      userId: viewer.id,
      videoId: VIDEO,
      progressSeconds: 30,
      durationSeconds: 60,
      watchedAt: new Date('2026-03-01T12:00:00.000Z'),
    });
    const videoOf = (page: SearchResult) => page.data.items[0]?.data;

    const mine = expectOk(await service.search(request('ownership'), viewer));
    const theirs = expectOk(await service.search(request('ownership')));

    expect(theirs.cache).toBe('HIT');
    expect(videoOf(mine)).toMatchObject({ viewer: { progressSeconds: 30 } });
    expect(videoOf(theirs)).not.toHaveProperty('viewer');
  });

  it('caches the page for the search TTL and times the hit on its own clock', async () => {
    const set = vi.spyOn(cache, 'set');
    expectOk(await service.search(request('rust')));
    clock = 1_007;

    const hit = expectOk(await service.search(request('rust')));

    expect(set).toHaveBeenCalledWith(
      expect.stringMatching(/^taitube:search:q:all:[0-9a-f]{64}$/),
      expect.any(String),
      SEARCH_CACHE_TTL_SECONDS
    );
    expect(hit).toMatchObject({ cache: 'HIT', data: { tookMs: 0, total: 1 } });
  });

  it.each([
    {
      name: 'a dead cache',
      arrange: (c: InMemoryCacheClient) =>
        vi.spyOn(c, 'get').mockResolvedValue(err(cacheUnavailable('get'))),
    },
    {
      name: 'an entry that no longer parses',
      arrange: (c: InMemoryCacheClient) => vi.spyOn(c, 'get').mockResolvedValue(ok('{"items":1}')),
    },
  ])('falls through $name to the repository', async ({ arrange }) => {
    arrange(cache);

    const page = expectOk(await service.search(request('rust')));

    expect(page).toMatchObject({ cache: 'MISS', data: { total: 1 } });
  });

  it('hands a database failure back and neither caches nor learns the query', async () => {
    vi.spyOn(repositories.search, 'search').mockResolvedValue(
      err(databaseUnavailable('search', 'down'))
    );
    const set = vi.spyOn(cache, 'set');

    const failure = expectErr(await service.search(request('rust')));

    expect(failure.code).toBe(ErrorCodes.DATABASE_UNAVAILABLE);
    expect(set).not.toHaveBeenCalled();
    expect(expectOk(await suggestions.suggest('ru', 10))).toEqual([]);
  });

  it('refuses a query the parser reads as matching everything, and caches nothing', async () => {
    vi.spyOn(repositories.search, 'restricts').mockResolvedValue(ok(false));
    const search = vi.spyOn(repositories.search, 'search');
    const set = vi.spyOn(cache, 'set');

    const failure = expectErr(await service.search(request('-"lo fi"')));

    expect(failure).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED, field: 'q' });
    expect(search).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('suggests the channels alone while the suggestion index is down', async () => {
    vi.spyOn(suggestions, 'suggest').mockResolvedValue(err(cacheUnavailable('suggest')));

    const found = expectOk(await service.suggest('rust'));

    expect(found.items).toEqual([
      {
        type: 'channel',
        text: 'Rustacean Station',
        channelId: CHANNEL,
        handle: 'rustacean',
        avatarUrl: null,
      },
    ]);
  });

  it('completes a query longer than the indexed prefixes from the longest one', async () => {
    const long = 'rust ownership explained in depth';
    expectOk(await suggestions.record(long));
    expectOk(await suggestions.record('rust ownership explained badly'));

    const found = expectOk(await service.suggest('rust ownership explained in'));

    expect(found.items).toEqual([{ type: 'query', text: long }]);
  });

  describe('search history', () => {
    const SEARCHER = { id: '00000000-0000-7000-8000-0000000047f1', role: 'USER' } as const;

    const trail = async () =>
      expectOk(await repositories.searchHistory.list(SEARCHER.id, { cursor: null, limit: 10 }));

    it('records what a signed-in viewer searched, moving a repeat to the top with the latest text', async () => {
      expectOk(await service.search(request('Rust'), SEARCHER));
      expectOk(await service.search(request('ownership'), SEARCHER));
      clock += 1_000;
      expectOk(await service.search(request('rust'), SEARCHER));

      expect((await trail()).map((row) => row.query)).toEqual(['rust', 'ownership']);
    });

    it('records for a cached page too, and never the filters', async () => {
      expectOk(await service.search(request('rust')));

      const hit = expectOk(await service.search({ ...request('rust'), type: 'video' }, SEARCHER));
      const cached = expectOk(await service.search(request('rust'), SEARCHER));

      expect(hit.cache).toBe('MISS');
      expect(cached.cache).toBe('HIT');
      expect(await trail()).toEqual([expect.objectContaining({ query: 'rust' })]);
    });

    it('records nothing for a guest, nor for a later page', async () => {
      await seedSecondRustVideo();
      expectOk(await service.search({ ...request('rust'), limit: 1 }));
      const first = expectOk(await service.search({ ...request('rust'), limit: 1 }, SEARCHER));
      expect(await trail()).toHaveLength(1);
      expectOk(await repositories.searchHistory.removeAll(SEARCHER.id));

      const { nextCursor } = first.data;
      expect(nextCursor).not.toBeNull();
      expectOk(
        await service.search(
          { ...request('rust'), limit: 1, cursor: nextCursor ?? undefined },
          SEARCHER
        )
      );

      expect(await trail()).toEqual([]);
    });

    it('records nothing while the viewer has paused their history', async () => {
      expectOk(
        await repositories.userPreferences.save({
          userId: SEARCHER.id,
          preferences: {
            appearance: null,
            playback: null,
            privacy: { ...DEFAULT_PREFERENCES.privacy, historyPaused: true },
            notifications: null,
          },
          expectedVersion: 0,
          sections: ['privacy'],
        })
      );

      expectOk(await service.search(request('rust'), SEARCHER));

      expect(await trail()).toEqual([]);
    });

    it('answers the search when the history cannot be written', async () => {
      vi.spyOn(repositories.searchHistory, 'record').mockResolvedValue(
        err(databaseUnavailable('recordSearchHistory'))
      );

      expect(expectOk(await service.search(request('rust'), SEARCHER)).data.total).toBe(1);
    });
  });
});

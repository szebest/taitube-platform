import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemorySearchSuggestionIndex,
} from '@vp/adapters/in-memory';
import { Singleflight } from '@vp/concurrency';
import { SEARCH_CACHE_TTL_SECONDS, SEARCH_SUGGESTIONS } from '@vp/domain';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes, cacheUnavailable, databaseUnavailable } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { SearchService } from '../search-service';

const OWNER = '00000000-0000-7000-8000-0000000047e1';
const VIDEO = '00000000-0000-7000-8000-0000000047a1';
const CHANNEL = '00000000-0000-7000-8000-0000000047c1';

describe('apps/api/services: SearchService', () => {
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  let suggestions: InMemorySearchSuggestionIndex;
  let clock: number;
  let service: SearchService;

  const request = (q: string) => ({ q, type: 'all', sort: 'relevance', limit: 20 }) as const;

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
      cdn: inProcessAppConfig().cdn,
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
});

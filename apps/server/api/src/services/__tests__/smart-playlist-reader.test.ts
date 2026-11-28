import { databaseUnavailable } from '@kit/errors';
import { err } from '@kit/result';
import { expectOk } from '@kit/testing/result';
import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import type { SmartPlaylistRules } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { seedVideo } from '../../__tests__/test-app';
import { SmartPlaylistReader } from '../smart-playlist-reader';
import { TEST_CDN, TEST_SPRITE } from './service-deps';

const LIST = '00000000-0000-7000-8000-0000000000d1';
const OWNER = '00000000-0000-7000-8000-0000000000d2';
const VIDEO = '00000000-0000-7000-8000-0000000000d3';
const VIEWER: UserContext = { id: OWNER, role: 'USER' };
const EVERYTHING: SmartPlaylistRules = { match: 'all', conditions: [], sort: 'newest', limit: 10 };
const UNWATCHED: SmartPlaylistRules = { ...EVERYTHING, conditions: [{ field: 'unwatched' }] };

async function setUp() {
  const repositories = new InMemoryRepositories();
  await seedVideo(repositories, { id: VIDEO, ownerId: OWNER, title: 'Clip' });
  const evaluate = vi.spyOn(repositories.smartPlaylists, 'evaluate');
  const reader = new SmartPlaylistReader({
    smart: repositories.smartPlaylists,
    cache: new InMemoryCacheClient(),
    cdn: TEST_CDN,
    sprite: TEST_SPRITE,
    now: Date.now,
  });
  const page = (rules: SmartPlaylistRules, viewer: UserContext | null) =>
    reader.page({ id: LIST, rules }, viewer, { cursor: null, limit: 5 });
  return { evaluate, page };
}

describe('SmartPlaylistReader', () => {
  it('shows a computed video as an item of its own, in its place, with the key its cursor carries', async () => {
    const { page } = await setUp();

    const [row] = expectOk(await page(EVERYTHING, null));

    expect(row?.item).toMatchObject({
      id: VIDEO,
      videoId: VIDEO,
      position: 0,
      addedBy: null,
      note: null,
    });
    expect(typeof row?.key).toBe('number');
  });

  it.each([
    { scenario: 'rules that read no viewer', rules: EVERYTHING, viewer: VIEWER, queries: 1 },
    { scenario: 'unwatched for a guest', rules: UNWATCHED, viewer: null, queries: 1 },
    { scenario: 'unwatched for a viewer', rules: UNWATCHED, viewer: VIEWER, queries: 2 },
  ])('queries $queries times for two reads of $scenario', async ({ rules, viewer, queries }) => {
    const { evaluate, page } = await setUp();

    expectOk(await page(rules, viewer));
    expectOk(await page(rules, viewer));

    expect(evaluate).toHaveBeenCalledTimes(queries);
  });

  it('misses the cache once the rules change', async () => {
    const { evaluate, page } = await setUp();

    expectOk(await page(EVERYTHING, null));
    expectOk(await page({ ...EVERYTHING, limit: 4 }, null));

    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('caches no failure', async () => {
    const { evaluate, page } = await setUp();
    evaluate.mockResolvedValueOnce(err(databaseUnavailable('evaluateSmartPlaylist')));

    const failed = await page(EVERYTHING, null);
    const retried = await page(EVERYTHING, null);

    expect([failed.ok, retried.ok]).toEqual([false, true]);
    expect(evaluate).toHaveBeenCalledTimes(2);
  });
});

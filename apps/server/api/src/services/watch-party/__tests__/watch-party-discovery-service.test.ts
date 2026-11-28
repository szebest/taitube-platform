import { Paginator } from '@kit/pagination';
import { expectErr, expectOk } from '@kit/testing/result';
import type { ListWatchPartiesQuery } from '@vp/api-contracts';
import { WATCH_PARTY_DISCOVERY_SORTS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { WatchPartyDiscoveryService } from '../watch-party-discovery-service';
import {
  MEMBER,
  type OWNER,
  seedParty,
  startParty,
  VIDEO_A,
  VIDEO_B,
  VIDEO_C,
  watchPartyTestDeps,
} from './watch-party-test-deps';

const QUERY: ListWatchPartiesQuery = {
  status: 'all',
  access: 'any',
  size: 'any',
  space: false,
  followed: false,
  creator: false,
  kind: 'any',
  sort: 'members',
  limit: 24,
};

async function setUp() {
  const test = watchPartyTestDeps();
  await seedParty(test);
  const service = new WatchPartyDiscoveryService({
    ...test.deps,
    cache: test.cache,
    paginator: new Paginator(),
  });
  const rooms = new Map<string, string>();
  for (const [name, videoId] of [
    ['Movie night', VIDEO_A],
    ['Gaming marathon', VIDEO_B],
    ['Quiet hours', VIDEO_C],
  ] as const) {
    const room = await startParty(test, { visibility: 'public', name, source: { videoId } });
    rooms.set(name, room.id);
  }
  const list = (
    overrides: Partial<ListWatchPartiesQuery> = {},
    viewer: typeof OWNER | null = null
  ) => service.list(viewer, { ...QUERY, ...overrides });
  return { ...test, list, rooms };
}

describe('apps/server/api/services: WatchPartyDiscoveryService', () => {
  it('lists a public room as a card carrying its owner, video, roster and clock snapshot', async () => {
    const { list, rooms } = await setUp();

    const page = expectOk(await list({ q: 'movie' }));

    expect(page.items).toMatchObject([
      {
        id: rooms.get('Movie night'),
        name: 'Movie night',
        owner: { name: 'Olivia Owner' },
        currentVideo: { id: VIDEO_A, title: 'First', categoryId: null },
        roster: { total: 0, faces: [] },
        playback: { phase: 'lobby' },
        presentCount: 0,
        hasPassword: false,
      },
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it('finds a typo through the trigram fallback, and nothing for an unrelated word', async () => {
    const { list, rooms } = await setUp();

    expect(expectOk(await list({ q: 'moovie' })).items.map(({ id }) => id)).toEqual([
      rooms.get('Movie night'),
    ]);
    expect(expectOk(await list({ q: 'zzzzzz' })).items).toEqual([]);
  });

  it('refuses a search of exclusions only', async () => {
    const { list } = await setUp();

    expect(expectErr(await list({ q: '-movie' }))).toMatchObject({ field: 'q' });
  });

  it.each(WATCH_PARTY_DISCOVERY_SORTS)(
    'refuses a members cursor under the %s sort unless it is the members sort',
    async (sort) => {
      const { list } = await setUp();
      const { nextCursor } = expectOk(await list({ limit: 1 }));
      expect(nextCursor).not.toBeNull();

      const resumed = await list({ sort, cursor: nextCursor ?? undefined });

      if (sort === 'members') expectOk(resumed);
      else expect(expectErr(resumed).code).toBe(ErrorCodes.INVALID_CURSOR);
    }
  );

  it('refuses a cursor whose id is not a UUID', async () => {
    const { list } = await setUp();
    const forged = Buffer.from(
      JSON.stringify({ sort: 'members', mode: 'lexical', key: 0, id: "x' or 1=1" })
    ).toString('base64url');

    expect(expectErr(await list({ cursor: forged })).code).toBe(ErrorCodes.INVALID_CURSOR);
  });

  it('keeps a signed-out first page for the cache window and shows a signed-in caller the live one', async () => {
    const test = await setUp();
    const before = expectOk(await test.list());
    await startParty(
      test,
      { visibility: 'public', name: 'Late arrival', source: { videoId: VIDEO_A } },
      MEMBER
    );

    expect(expectOk(await test.list())).toEqual(before);
    expect(expectOk(await test.list({}, MEMBER)).items).toHaveLength(before.items.length + 1);
  });
});

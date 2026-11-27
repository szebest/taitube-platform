import { expectOk } from '@kit/testing/result';
import type { DiscoverableRoom } from '@vp/core/repositories';
import {
  WATCH_PARTY_DISCOVERY_SORTS,
  type WatchPartyDiscoveryFilters,
  type WatchPartyDiscoverySort,
  watchPartyDiscoveryPosition,
  watchPartyTrendScore,
} from '@vp/domain';
import { idsOf } from './fixtures';
import type { MakeRepositoriesSubject } from './subjects';
import {
  type DiscoveryOverrides,
  discoveryQuery,
  follow,
  GAMING,
  LATE,
  LISTED,
  MOVIE,
  NOW,
  room,
  seedDiscoveryWorld,
  SOLO,
  TWIN_ONE,
  TWIN_TWO,
} from './watch-party-discovery-fixtures';
import { later, setUpWatchParty } from './watch-party-fixtures';

const BANNED_FROM = room(12);
const byId = (a: DiscoverableRoom, b: DiscoverableRoom) => (a.room.id < b.room.id ? -1 : 1);

const ORDERS: Record<
  WatchPartyDiscoverySort,
  (a: DiscoverableRoom, b: DiscoverableRoom) => number
> = {
  members: (a, b) => b.room.presentCount - a.room.presentCount || byId(a, b),
  newest: (a, b) => b.room.createdAt.getTime() - a.room.createdAt.getTime() || byId(a, b),
  starting_soon: (a, b) =>
    (a.room.scheduledFor?.getTime() ?? 0) - (b.room.scheduledFor?.getTime() ?? 0) || byId(a, b),
  trending: (a, b) => b.trendScore - a.trendScore || byId(a, b),
};

export function describeWatchPartyDiscoveryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('WatchPartyRoomRepository discovery contract', () => {
    const party = setUpWatchParty(makeSubject);
    const list = async (overrides: DiscoveryOverrides = {}) =>
      expectOk(
        await party.subject.repositories.watchPartyRooms.listDiscoverable(discoveryQuery(overrides))
      );
    const listedIds = async (overrides?: DiscoveryOverrides) =>
      idsOf((await list(overrides)).map(({ room: found }) => found)).sort();

    beforeEach(async () => {
      await seedDiscoveryWorld(party.subject);
      await follow(party.subject);
    });

    it.each<{ scenario: string; filters: Partial<WatchPartyDiscoveryFilters>; expected: string[] }>(
      [
        { scenario: 'q by room name', filters: { text: 'movie' }, expected: [MOVIE] },
        {
          scenario: 'q by owner handle',
          filters: { text: 'owner' },
          expected: [MOVIE, GAMING, SOLO],
        },
        { scenario: 'q by current video title', filters: { text: 'speedrun' }, expected: [GAMING] },
        { scenario: 'q with a typo, lexical', filters: { text: 'moovie' }, expected: [] },
        { scenario: 'status now', filters: { status: 'now' }, expected: [GAMING] },
        { scenario: 'status lobby', filters: { status: 'lobby' }, expected: [MOVIE, SOLO] },
        {
          scenario: 'status scheduled',
          filters: { status: 'scheduled' },
          expected: [LATE, TWIN_ONE, TWIN_TWO],
        },
        {
          scenario: 'category music',
          filters: { categoryId: '00000000-0000-7000-8000-000000000201' },
          expected: [MOVIE, TWIN_ONE, TWIN_TWO, SOLO],
        },
        {
          scenario: 'category gaming',
          filters: { categoryId: '00000000-0000-7000-8000-000000000202' },
          expected: [GAMING],
        },
        { scenario: 'language pl', filters: { language: 'pl' }, expected: [GAMING] },
        { scenario: 'language en', filters: { language: 'en' }, expected: [MOVIE, LATE] },
        { scenario: 'access password', filters: { access: 'password' }, expected: [GAMING] },
        {
          scenario: 'access open',
          filters: { access: 'open' },
          expected: [MOVIE, LATE, TWIN_ONE, TWIN_TWO, SOLO],
        },
        { scenario: 'size small', filters: { size: 'small' }, expected: [MOVIE, SOLO] },
        {
          scenario: 'size medium',
          filters: { size: 'medium' },
          expected: [GAMING, TWIN_ONE, TWIN_TWO],
        },
        { scenario: 'size large', filters: { size: 'large' }, expected: [LATE] },
        {
          scenario: 'space leaves the full room out',
          filters: { space: true },
          expected: [MOVIE, LATE, TWIN_ONE, TWIN_TWO, SOLO],
        },
        { scenario: 'followed', filters: { followed: true }, expected: [MOVIE, GAMING, SOLO] },
        { scenario: 'creator', filters: { creator: true }, expected: [GAMING] },
        {
          scenario: 'kind single',
          filters: { kind: 'single' },
          expected: [MOVIE, TWIN_ONE, TWIN_TWO, SOLO],
        },
        { scenario: 'kind playlist', filters: { kind: 'playlist' }, expected: [GAMING] },
      ]
    )('filters by $scenario', async ({ filters, expected }) => {
      expect(await listedIds({ filters })).toEqual([...expected].sort());
    });

    it('finds a typo through the trigram fallback and nothing for an unrelated word', async () => {
      expect(await listedIds({ mode: 'fuzzy', filters: { text: 'moovie' } })).toEqual([MOVIE]);
      expect(await listedIds({ mode: 'fuzzy', filters: { text: 'zzzzzz' } })).toEqual([]);
    });

    it('ignores followed for a signed-out viewer', async () => {
      expect(await listedIds({ viewerId: null, filters: { followed: true } })).toEqual(
        [...LISTED, BANNED_FROM].sort()
      );
    });

    it('never lists a private, unlisted, closed, hidden or banned-from room, or one playing a non-public video', async () => {
      expect(await listedIds()).toEqual([...LISTED].sort());
      expect(await listedIds({ viewerId: null })).toContain(BANNED_FROM);
    });

    it.each(WATCH_PARTY_DISCOVERY_SORTS)(
      'walks the %s keyset to the end with no gap',
      async (sort) => {
        const filters = sort === 'starting_soon' ? { status: 'scheduled' as const } : {};
        const everything = await list({ sort, filters, limit: 50 });
        const expected = everything.map(({ room: found }) => found.id);
        expect(expected).toEqual(
          [...everything].sort(ORDERS[sort]).map(({ room: found }) => found.id)
        );
        expect(expected).toHaveLength(sort === 'starting_soon' ? 3 : LISTED.length);

        const walked: string[] = [];
        for (let after = null as ReturnType<typeof watchPartyDiscoveryPosition> | null; ;) {
          const rows = await list({ sort, filters, limit: 2, after });
          const page = rows.slice(0, 2);
          walked.push(...page.map(({ room: found }) => found.id));
          if (rows.length <= 2) break;
          after = watchPartyDiscoveryPosition(sort, page[page.length - 1] as DiscoverableRoom);
        }
        expect(walked).toEqual(expected);
      }
    );

    it('scores trending from joins in the last half hour, the present count and the age', async () => {
      for (const { room: found, trendScore } of await list({ sort: 'trending' })) {
        expect(trendScore).toBeCloseTo(
          watchPartyTrendScore({
            recentJoins: 1,
            present: found.presentCount,
            ageMs: NOW.getTime() - found.createdAt.getTime(),
          }),
          8
        );
      }
      expect(later(10)).toEqual(NOW);
    });
  });
}

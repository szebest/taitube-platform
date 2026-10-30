import type { SearchHistoryRepositoryPort } from '@vp/core/repositories';
import { SEARCH_HISTORY_LIMIT, type SearchHistoryEntry } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { HOUR_MS, OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const BASE = Date.parse('2026-03-01T12:00:00.000Z');

const rowId = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;

function entry(query: string, minutesAgo = 0, userId = OTHER_OWNER_ID, n = 1) {
  return {
    id: rowId(n),
    userId,
    query,
    queryKey: query.toLowerCase(),
    searchedAt: new Date(BASE - minutesAgo * 60_000),
  };
}

const queriesOf = (entries: readonly SearchHistoryEntry[]) => entries.map((row) => row.query);

export function describeSearchHistoryRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('SearchHistoryRepository contract', () => {
    let subject: RepositoriesSubject;
    let history: SearchHistoryRepositoryPort;

    const list = async (userId = OTHER_OWNER_ID, limit = 200) =>
      expectOk(await history.list(userId, { cursor: null, limit }));

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      history = subject.repositories.searchHistory;
    });

    it('records a query and lists it newest first', async () => {
      expectOk(await history.record(entry('cats', 3, OTHER_OWNER_ID, 1)));
      expectOk(await history.record(entry('dogs', 1, OTHER_OWNER_ID, 2)));
      expectOk(await history.record(entry('birds', 2, OTHER_OWNER_ID, 3)));

      expect(await list()).toEqual([
        { id: rowId(2), query: 'dogs', searchedAt: new Date(BASE - 60_000) },
        { id: rowId(3), query: 'birds', searchedAt: new Date(BASE - 120_000) },
        { id: rowId(1), query: 'cats', searchedAt: new Date(BASE - 180_000) },
      ]);
    });

    it('moves a repeated query to the top with the text as last typed, adding no row', async () => {
      expectOk(await history.record(entry('Cats', 5, OTHER_OWNER_ID, 1)));
      expectOk(await history.record(entry('dogs', 3, OTHER_OWNER_ID, 2)));
      expectOk(
        await history.record({
          ...entry('cats', 0, OTHER_OWNER_ID, 3),
          query: 'CATS',
          queryKey: 'cats',
        })
      );

      expect(queriesOf(await list())).toEqual(['CATS', 'dogs']);
    });

    it('keeps one row per query for each user', async () => {
      expectOk(await history.record(entry('cats', 0, OTHER_OWNER_ID, 1)));
      expectOk(await history.record(entry('cats', 0, OWNER_ID, 2)));

      expect(await list(OTHER_OWNER_ID)).toHaveLength(1);
      expect(await list(OWNER_ID)).toHaveLength(1);
    });

    it('keeps the newest rows when a distinct query goes past the limit, for that user only', async () => {
      for (let n = 0; n < SEARCH_HISTORY_LIMIT; n++) {
        expectOk(
          await history.record(entry(`q${n}`, SEARCH_HISTORY_LIMIT - n, OTHER_OWNER_ID, n + 1))
        );
      }
      expectOk(await history.record(entry('mine', 500, OWNER_ID, 900)));
      expectOk(await history.record(entry('overflow', 0, OTHER_OWNER_ID, 901)));

      const kept = await list();

      expect(kept).toHaveLength(SEARCH_HISTORY_LIMIT);
      expect(kept[0]?.query).toBe('overflow');
      expect(queriesOf(kept)).not.toContain('q0');
      expect(queriesOf(kept)).toContain('q1');
      expect(await list(OWNER_ID)).toHaveLength(1);
    });

    it('repeating a query at the limit drops nothing', async () => {
      for (let n = 0; n < SEARCH_HISTORY_LIMIT; n++) {
        expectOk(
          await history.record(entry(`q${n}`, SEARCH_HISTORY_LIMIT - n, OTHER_OWNER_ID, n + 1))
        );
      }

      expectOk(await history.record(entry('q0', 0, OTHER_OWNER_ID, 902)));

      const kept = await list();
      expect(kept).toHaveLength(SEARCH_HISTORY_LIMIT);
      expect(kept[0]?.query).toBe('q0');
    });

    it('walks on from a cursor, ties on the time broken by id', async () => {
      expectOk(await history.record(entry('a', 5, OTHER_OWNER_ID, 1)));
      expectOk(await history.record(entry('b', 1, OTHER_OWNER_ID, 2)));
      expectOk(await history.record(entry('c', 1, OTHER_OWNER_ID, 3)));
      expectOk(await history.record(entry('d', 9, OTHER_OWNER_ID, 4)));

      const first = expectOk(await history.list(OTHER_OWNER_ID, { cursor: null, limit: 2 }));
      const last = first[1];
      const rest = last
        ? expectOk(
            await history.list(OTHER_OWNER_ID, {
              cursor: { searchedAt: last.searchedAt, id: last.id },
              limit: 5,
            })
          )
        : [];

      expect(queriesOf(first)).toEqual(['c', 'b', 'a']);
      expect(queriesOf(rest)).toEqual(['a', 'd']);
    });

    it('removes one row of the caller, and nothing of anyone else', async () => {
      expectOk(await history.record(entry('cats', 0, OTHER_OWNER_ID, 1)));
      expectOk(await history.record(entry('dogs', 0, OWNER_ID, 2)));

      expect(expectOk(await history.remove(OTHER_OWNER_ID, rowId(2)))).toBe(false);
      expect(expectOk(await history.remove(OTHER_OWNER_ID, rowId(1)))).toBe(true);
      expect(expectOk(await history.remove(OTHER_OWNER_ID, rowId(1)))).toBe(false);
      expect(queriesOf(await list(OWNER_ID))).toEqual(['dogs']);
    });

    it('removes every row of the caller, and only theirs', async () => {
      expectOk(await history.record(entry('cats', 0, OTHER_OWNER_ID, 1)));
      expectOk(await history.record(entry('birds', 1, OTHER_OWNER_ID, 3)));
      expectOk(await history.record(entry('dogs', 0, OWNER_ID, 2)));

      expectOk(await history.removeAll(OTHER_OWNER_ID));

      expect(await list(OTHER_OWNER_ID)).toEqual([]);
      expect(queriesOf(await list(OWNER_ID))).toEqual(['dogs']);
    });

    it('purges the rows searched before the cutoff, for every user', async () => {
      expectOk(await history.record(entry('old', 3 * 60, OTHER_OWNER_ID, 1)));
      expectOk(await history.record(entry('older', 5 * 60, OWNER_ID, 2)));
      expectOk(await history.record(entry('fresh', 60, OTHER_OWNER_ID, 3)));

      const purged = expectOk(await history.purgeOlderThan(new Date(BASE - 2 * HOUR_MS)));

      expect(purged).toBe(2);
      expect(queriesOf(await list(OTHER_OWNER_ID))).toEqual(['fresh']);
      expect(await list(OWNER_ID)).toEqual([]);
    });
  });
}

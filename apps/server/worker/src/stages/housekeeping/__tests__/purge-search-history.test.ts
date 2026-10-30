import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { MS_PER_DAY } from '@vp/domain/time';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { runPurgeSearchHistory } from '../purge-search-history';

const NOW = Date.parse('2026-06-01T03:15:00.000Z');
const RETENTION_DAYS = 90;
const USER = '00000000-0000-7000-8000-00000000a001';

describe('housekeeping: purge-search-history', () => {
  let repositories: InMemoryRepositories;

  const searched = async (query: string, daysAgo: number) =>
    expectOk(
      await repositories.searchHistory.record({
        id: uuidv7(),
        userId: USER,
        query,
        queryKey: query,
        searchedAt: new Date(NOW - daysAgo * MS_PER_DAY),
      })
    );

  const purge = () =>
    runPurgeSearchHistory({ repositories, retentionDays: RETENTION_DAYS, now: () => NOW });

  const remaining = async () =>
    expectOk(await repositories.searchHistory.list(USER, { cursor: null, limit: 10 })).map(
      (row) => row.query
    );

  beforeEach(() => {
    repositories = new InMemoryRepositories();
  });

  it('deletes the rows searched more than the retention ago and keeps the rest', async () => {
    await searched('ancient', 200);
    await searched('stale', 91);
    await searched('edge', 89.9);
    await searched('fresh', 1);

    expect(expectOk(await purge())).toEqual({ purgedCount: 2 });
    expect(await remaining()).toEqual(['fresh', 'edge']);
  });

  it('has nothing to do on an empty table', async () => {
    expect(expectOk(await purge())).toEqual({ purgedCount: 0 });
  });
});

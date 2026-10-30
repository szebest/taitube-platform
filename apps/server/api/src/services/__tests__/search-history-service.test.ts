import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes, databaseUnavailable } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { SearchHistoryService } from '../search-history-service';

const VIEWER: UserContext = { id: '00000000-0000-7000-8000-00000000e001', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000e002', role: 'USER' };
const BASE = Date.parse('2026-03-01T12:00:00.000Z');

const rowId = (n: number) => `00000000-0000-7000-8000-00000000e1${String(n).padStart(2, '0')}`;

describe('apps/server/api/services: SearchHistoryService', () => {
  let repositories: InMemoryRepositories;
  let service: SearchHistoryService;

  const searched = async (n: number, user: UserContext = VIEWER) =>
    expectOk(
      await repositories.searchHistory.record({
        id: rowId(n),
        userId: user.id,
        query: `Query ${n}`,
        queryKey: `query ${n}`,
        searchedAt: new Date(BASE + n * 60_000),
      })
    );

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    service = new SearchHistoryService({
      history: repositories.searchHistory,
      paginator: new Paginator({ defaultLimit: 20, maxLimit: 100 }),
    });
  });

  it('lists the caller searches newest first and walks the rest from the cursor', async () => {
    for (const n of [1, 2, 3]) await searched(n);
    await searched(9, STRANGER);

    const first = expectOk(await service.list(VIEWER, { limit: 2 }));
    const rest = expectOk(await service.list(VIEWER, { limit: 2, cursor: first.nextCursor ?? '' }));

    expect(first.items).toEqual([
      { id: rowId(3), query: 'Query 3', searchedAt: new Date(BASE + 180_000).toISOString() },
      { id: rowId(2), query: 'Query 2', searchedAt: new Date(BASE + 120_000).toISOString() },
    ]);
    expect(first.nextCursor).not.toBeNull();
    expect(rest.items.map((item) => item.id)).toEqual([rowId(1)]);
    expect(rest.nextCursor).toBeNull();
  });

  it('refuses a cursor that is not one', async () => {
    expect(expectErr(await service.list(VIEWER, { cursor: 'nope' })).code).toBe(
      ErrorCodes.INVALID_CURSOR
    );
  });

  it('removes an entry of the caller and answers not found for anyone else', async () => {
    await searched(1);

    expect(expectErr(await service.remove(STRANGER, rowId(1))).code).toBe(
      ErrorCodes.SEARCH_HISTORY_NOT_FOUND
    );
    expectOk(await service.remove(VIEWER, rowId(1)));
    expect(expectErr(await service.remove(VIEWER, rowId(1))).code).toBe(
      ErrorCodes.SEARCH_HISTORY_NOT_FOUND
    );
  });

  it('clears the caller trail only', async () => {
    await searched(1);
    await searched(2, STRANGER);

    expectOk(await service.clear(VIEWER));

    expect(expectOk(await service.list(VIEWER, {})).items).toEqual([]);
    expect(expectOk(await service.list(STRANGER, {})).items).toHaveLength(1);
  });

  it('hands a database failure back', async () => {
    const failure = databaseUnavailable('listSearchHistory');
    vi.spyOn(repositories.searchHistory, 'list').mockResolvedValue(err(failure));

    expect(expectErr(await service.list(VIEWER, {}))).toBe(failure);
  });
});

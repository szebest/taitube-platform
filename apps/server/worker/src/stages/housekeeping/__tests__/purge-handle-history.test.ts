import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { HANDLE_RESERVATION_DAYS } from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import { expectOk } from '@vp/testing/result';
import { runPurgeHandleHistory } from '../purge-handle-history';

describe('housekeeping: purge-handle-history', () => {
  let repositories: InMemoryRepositories;

  const purgeAfter = (days: number) =>
    runPurgeHandleHistory({
      repositories,
      reservationDays: HANDLE_RESERVATION_DAYS,
      now: () => Date.now() + days * MS_PER_DAY,
    });

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    repositories.channelHandleHistory.retire({
      handle: 'old-name',
      channelId: '00000000-0000-7000-8000-00000000c001',
      retiredAt: new Date(),
    });
  });

  it.each([
    { scenario: 'keeps a handle inside the 90 days', days: 89, purgedCount: 0, held: true },
    { scenario: 'frees a handle past the 90 days', days: 91, purgedCount: 1, held: false },
  ])('$scenario', async ({ days, purgedCount, held }) => {
    expect(expectOk(await purgeAfter(days))).toEqual({ purgedCount });
    expect(expectOk(await repositories.channelHandleHistory.findByHandle('old-name'))).toEqual(
      held ? expect.objectContaining({ handle: 'old-name' }) : null
    );
  });
});

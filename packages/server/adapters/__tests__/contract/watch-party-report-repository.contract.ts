import { expectOk } from '@kit/testing/result';
import { REPORTS_TO_HIDE_ROOM, type WatchPartyReport } from '@vp/domain';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import {
  accountId,
  AT,
  numberedId,
  OWNER_KEY,
  ROOM_ID,
  seedRoomWorld,
  userKey,
} from './watch-party-activity-fixtures';

const reportId = (n: number) => numberedId(13, n);

function report(n: number, overrides: Partial<WatchPartyReport> = {}): WatchPartyReport {
  return {
    id: reportId(n),
    roomId: ROOM_ID,
    reporterId: accountId(2 + n),
    targetKey: null,
    context: 'room',
    reason: 'spam',
    details: null,
    createdAt: AT,
    ...overrides,
  };
}

export function describeWatchPartyReportRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('WatchPartyReportRepository contract', () => {
    let subject: RepositoriesSubject;

    const reports = () => subject.repositories.watchPartyReports;
    const file = async (n: number, overrides: Partial<WatchPartyReport> = {}) =>
      expectOk(await reports().file(report(n, overrides), REPORTS_TO_HIDE_ROOM, AT));
    const hiddenAt = async () =>
      expectOk(await subject.repositories.watchPartyRooms.findById(ROOM_ID))?.hiddenAt;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedRoomWorld(subject);
    });

    it.each([
      { scenario: 'the room twice', second: {} },
      { scenario: 'one member twice', second: { targetKey: userKey(accountId(5)) } },
    ])('takes one report per reporter for $scenario', async ({ second }) => {
      expect(await file(1, second)).toEqual({ type: 'filed', hidden: false });

      expect(await file(2, { ...second, reporterId: accountId(3) })).toEqual({
        type: 'duplicate',
      });
    });

    it('hides the room when the third distinct account reports it, once', async () => {
      expect(await file(1)).toEqual({ type: 'filed', hidden: false });
      expect(await file(2)).toEqual({ type: 'filed', hidden: false });
      expect(await hiddenAt()).toBeNull();

      expect(await file(3)).toEqual({ type: 'filed', hidden: true });
      expect(await hiddenAt()).toEqual(AT);
      expect(await file(4)).toEqual({ type: 'filed', hidden: false });
    });

    it('counts room reports only: member reports never hide the room', async () => {
      for (const n of [1, 2, 3]) await file(n, { targetKey: OWNER_KEY });

      expect(await hiddenAt()).toBeNull();
    });

    it('restores a hidden room, resolves its reports and starts the count again', async () => {
      for (const n of [1, 2, 3]) await file(n);

      expect(expectOk(await reports().restore(ROOM_ID, AT))).toBe(true);
      expect(await hiddenAt()).toBeNull();

      expect(await file(4, { reporterId: accountId(8) })).toEqual({ type: 'filed', hidden: false });
      expect(await hiddenAt()).toBeNull();
    });

    it('answers false when the room is gone', async () => {
      expect(expectOk(await reports().restore(numberedId(9, 9), AT))).toBe(false);
    });
  });
}

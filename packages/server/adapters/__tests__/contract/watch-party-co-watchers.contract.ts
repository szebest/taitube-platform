import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID } from './fixtures';
import type { MakeRepositoriesSubject } from './subjects';
import { accountId, userKey } from './watch-party-activity-fixtures';
import { later, OTHER_KEY, ROOM_ID, setUpWatchParty } from './watch-party-fixtures';
import { accountSeat, guestSeat } from './watch-party-member-fixtures';

export function describeWatchPartyCoWatchersContract(makeSubject: MakeRepositoriesSubject): void {
  describe('WatchPartyMemberRepository co-watchers contract', () => {
    const party = setUpWatchParty(makeSubject);
    const members = () => party.subject.repositories.watchPartyMembers;
    const coWatchers = async (since = later(0), limit = 10, userId = OWNER_ID) =>
      expectOk(await members().coWatchersOf(userId, since, limit));

    beforeEach(async () => {
      await party.subject.repositories.users.upsert({
        id: accountId(3),
        email: 'account3@video-pipeline.local',
      });
      await party.createRoom();
      expectOk(await members().join(accountSeat(), null));
      expectOk(
        await members().join(
          accountSeat({
            memberKey: userKey(accountId(3)),
            userId: accountId(3),
            joinedAt: later(4),
          }),
          null
        )
      );
      expectOk(await members().join(guestSeat(), null));
    });

    it('lists the other accounts who shared a room, the most recently seated first, no guests', async () => {
      expect(await coWatchers()).toEqual([accountId(3), OTHER_OWNER_ID]);
    });

    it.each([
      { scenario: 'a seat taken before the cut-off', since: later(2), limit: 10 },
      { scenario: 'all but the first of a limit', since: later(0), limit: 1 },
    ])('leaves out $scenario', async ({ since, limit }) => {
      expect(await coWatchers(since, limit)).toEqual([accountId(3)]);
    });

    it('lists nobody for an account that shared no room, and counts a seat that was left', async () => {
      expectOk(await members().leave(ROOM_ID, OTHER_KEY, null, later(5)));

      expect(await coWatchers(later(0), 10, accountId(9))).toEqual([]);
      expect(await coWatchers()).toContain(OTHER_OWNER_ID);
    });
  });
}

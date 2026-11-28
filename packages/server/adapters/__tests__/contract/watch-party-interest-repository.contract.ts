import { expectOk } from '@kit/testing/result';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import {
  accountId,
  AT,
  createRoom,
  MINUTE_MS,
  OTHER_ROOM_ID,
  ROOM_ID,
  seedRoomWorld,
} from './watch-party-activity-fixtures';

const later = (minutes: number) => new Date(AT.getTime() + minutes * MINUTE_MS);

export function describeWatchPartyInterestRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('WatchPartyInterestRepository contract', () => {
    let subject: RepositoriesSubject;

    const interest = () => subject.repositories.watchPartyInterest;

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

    it('lists who is interested, oldest first, and keeps the first row when asked twice', async () => {
      expectOk(await interest().add(ROOM_ID, accountId(4), later(2)));
      expectOk(await interest().add(ROOM_ID, accountId(3), later(1)));
      expectOk(await interest().add(ROOM_ID, accountId(4), later(9)));

      expect(expectOk(await interest().userIdsOf(ROOM_ID))).toEqual([accountId(3), accountId(4)]);
    });

    it('removes one account and is silent about an account that was not interested', async () => {
      expectOk(await interest().add(ROOM_ID, accountId(3), AT));
      expectOk(await interest().add(ROOM_ID, accountId(4), AT));

      expectOk(await interest().remove(ROOM_ID, accountId(3)));
      expectOk(await interest().remove(ROOM_ID, accountId(5)));

      expect(expectOk(await interest().userIdsOf(ROOM_ID))).toEqual([accountId(4)]);
    });

    it('lists the open rooms of an account, newest interest first, and leaves closed rooms out', async () => {
      await createRoom(subject, OTHER_ROOM_ID);
      expectOk(await interest().add(ROOM_ID, accountId(3), later(1)));
      expectOk(await interest().add(OTHER_ROOM_ID, accountId(3), later(2)));
      expect(expectOk(await interest().openRoomIdsOf(accountId(3)))).toEqual([
        OTHER_ROOM_ID,
        ROOM_ID,
      ]);

      expectOk(await subject.repositories.watchPartyRooms.close(OTHER_ROOM_ID, 'owner', null, AT));

      expect(expectOk(await interest().openRoomIdsOf(accountId(3)))).toEqual([ROOM_ID]);
    });
  });
}

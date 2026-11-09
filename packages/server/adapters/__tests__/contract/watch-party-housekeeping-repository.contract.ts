import { expectOk } from '@vp/testing/result';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import {
  AT,
  createRoom,
  MINUTE_MS,
  numberedId,
  OTHER_ROOM_ID,
  ROOM_ID,
  seedRoomWorld,
} from './watch-party-activity-fixtures';

const THIRD_ROOM_ID = '00000000-0000-7000-8000-00000000d003';
const DAY_MS = 24 * 60 * MINUTE_MS;

export function describeWatchPartyHousekeepingRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('WatchPartyHousekeepingRepository contract', () => {
    let subject: RepositoriesSubject;

    const housekeeping = () => subject.repositories.watchPartyHousekeeping;
    const rooms = () => subject.repositories.watchPartyRooms;
    const closeAt = async (roomId: string, at: Date) =>
      expectOk(await rooms().close(roomId, 'owner', null, at));
    const line = (n: number, roomId: string, createdAt: Date) =>
      subject.repositories.watchPartyMessages.append({
        id: numberedId(9, n),
        roomId,
        authorKey: null,
        source: 'app',
        kind: 'text',
        body: `line ${n}`,
        system: null,
        videoId: null,
        positionMs: null,
        createdAt,
      });

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedRoomWorld(subject);
      await createRoom(subject, OTHER_ROOM_ID);
      await createRoom(subject, THIRD_ROOM_ID);
    });

    describe('listOpen', () => {
      it('walks the open rooms in id order a page at a time, leaving closed rooms out', async () => {
        await closeAt(OTHER_ROOM_ID, AT);

        const first = expectOk(await housekeeping().listOpen(null, 1));
        const second = expectOk(await housekeeping().listOpen(first[0]?.id ?? null, 1));
        const rest = expectOk(await housekeeping().listOpen(second[0]?.id ?? null, 1));

        expect([first, second, rest].map((page) => page.map(({ id }) => id))).toEqual([
          [ROOM_ID],
          [THIRD_ROOM_ID],
          [],
        ]);
      });
    });

    describe('purgeClosedBefore', () => {
      it('removes the rooms closed before the cutoff with their lines, keeping open and newer ones', async () => {
        await closeAt(OTHER_ROOM_ID, new Date(AT.getTime() - 40 * DAY_MS));
        await closeAt(THIRD_ROOM_ID, new Date(AT.getTime() - DAY_MS));
        expectOk(await line(1, OTHER_ROOM_ID, AT));
        expectOk(await line(2, THIRD_ROOM_ID, AT));

        const removed = expectOk(
          await housekeeping().purgeClosedBefore(new Date(AT.getTime() - 30 * DAY_MS))
        );

        expect(removed).toBe(1);
        expect(expectOk(await rooms().findById(OTHER_ROOM_ID))).toBeNull();
        expect(expectOk(await rooms().findById(THIRD_ROOM_ID))).not.toBeNull();
        expect(expectOk(await rooms().findById(ROOM_ID))).not.toBeNull();
        const kept = subject.repositories.watchPartyMessages;
        expect(expectOk(await kept.listAfter(OTHER_ROOM_ID, null, 10))).toEqual([]);
        expect(expectOk(await kept.listAfter(THIRD_ROOM_ID, null, 10))).toHaveLength(1);
      });
    });

    describe('purgeMessagesBefore', () => {
      it('removes the lines sent before the cutoff in every room and keeps the rest', async () => {
        expectOk(await line(1, ROOM_ID, new Date(AT.getTime() - 8 * DAY_MS)));
        expectOk(await line(2, OTHER_ROOM_ID, new Date(AT.getTime() - 9 * DAY_MS)));
        expectOk(await line(3, ROOM_ID, new Date(AT.getTime() - DAY_MS)));

        const removed = expectOk(
          await housekeeping().purgeMessagesBefore(new Date(AT.getTime() - 7 * DAY_MS))
        );

        expect(removed).toBe(2);
        const messages = subject.repositories.watchPartyMessages;
        expect(expectOk(await messages.listAfter(ROOM_ID, null, 10)).map(({ id }) => id)).toEqual([
          numberedId(9, 3),
        ]);
      });
    });
  });
}

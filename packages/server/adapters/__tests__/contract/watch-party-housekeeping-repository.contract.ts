import { expectOk } from '@kit/testing/result';
import { NO_PERSONAL_CONTROL } from '@vp/domain';
import { OWNER_ID } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import {
  AT,
  createRoom,
  MINUTE_MS,
  numberedId,
  OTHER_ROOM_ID,
  OWNER_KEY,
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

    describe('databaseClock', () => {
      it('answers the time the database holds now', async () => {
        const before = Date.now();

        const clock = expectOk(await housekeeping().databaseClock());

        expect(Math.abs(clock.getTime() - before)).toBeLessThan(60_000);
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

    describe('purgeClosedBefore, what belongs to the room', () => {
      const GUEST_KEY = 'guest:abcdefghijklmnop';
      const IP_HASH = 'ip-hash-of-the-guest';
      const banIn = async (roomId: string, n: number) =>
        expectOk(
          await subject.repositories.watchPartyMembers.ban(
            {
              roomId,
              memberKey: GUEST_KEY,
              ipHash: IP_HASH,
              bannedBy: OWNER_KEY,
              reason: null,
              createdAt: AT,
            },
            {
              id: numberedId(8, n),
              line: { event: 'banned', actorKey: OWNER_KEY, targetKey: GUEST_KEY, detail: null },
              videoId: null,
              positionMs: null,
              createdAt: AT,
            }
          )
        );
      const controlIn = async (roomId: string | null) =>
        expectOk(
          await subject.repositories.watchPartyControls.put({
            ...NO_PERSONAL_CONTROL,
            userId: OWNER_ID,
            targetKey: `user:${numberedId(3, 7)}`,
            roomId,
            voiceMuted: true,
            updatedAt: AT,
          })
        );
      const controlsOf = async (roomId: string | null) =>
        expectOk(await subject.repositories.watchPartyControls.list(OWNER_ID, roomId));

      it('takes the room-scoped controls and guest ban hashes with a purged room, keeping the rest', async () => {
        await closeAt(OTHER_ROOM_ID, new Date(AT.getTime() - 40 * DAY_MS));
        await banIn(OTHER_ROOM_ID, 1);
        await banIn(THIRD_ROOM_ID, 2);
        await controlIn(OTHER_ROOM_ID);
        await controlIn(THIRD_ROOM_ID);
        await controlIn(null);

        expectOk(await housekeeping().purgeClosedBefore(new Date(AT.getTime() - 30 * DAY_MS)));

        const bans = subject.repositories.watchPartyMembers;
        expect(expectOk(await bans.isBanned(OTHER_ROOM_ID, GUEST_KEY, IP_HASH))).toBe(false);
        expect(expectOk(await bans.isBanned(THIRD_ROOM_ID, GUEST_KEY, IP_HASH))).toBe(true);
        expect(await controlsOf(OTHER_ROOM_ID)).toHaveLength(1);
        expect(await controlsOf(THIRD_ROOM_ID)).toHaveLength(2);
      });

      it('takes the interest and the reports of a purged room with it', async () => {
        await closeAt(OTHER_ROOM_ID, new Date(AT.getTime() - 40 * DAY_MS));
        const { watchPartyInterest, watchPartyReports } = subject.repositories;
        expectOk(await watchPartyInterest.add(OTHER_ROOM_ID, OWNER_ID, AT));
        expectOk(await watchPartyInterest.add(THIRD_ROOM_ID, OWNER_ID, AT));
        expectOk(
          await watchPartyReports.file(
            {
              id: numberedId(13, 1),
              roomId: OTHER_ROOM_ID,
              reporterId: OWNER_ID,
              targetKey: null,
              context: 'room',
              reason: 'spam',
              details: null,
              createdAt: AT,
            },
            3,
            AT
          )
        );

        expectOk(await housekeeping().purgeClosedBefore(new Date(AT.getTime() - 30 * DAY_MS)));

        expect(expectOk(await watchPartyInterest.userIdsOf(OTHER_ROOM_ID))).toEqual([]);
        expect(expectOk(await watchPartyInterest.userIdsOf(THIRD_ROOM_ID))).toEqual([OWNER_ID]);
        expect(expectOk(await watchPartyReports.restore(OTHER_ROOM_ID, AT))).toBe(false);
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

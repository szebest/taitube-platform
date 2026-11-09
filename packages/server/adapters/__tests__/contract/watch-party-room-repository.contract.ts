import { POSITION_GAP } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject } from './subjects';
import {
  AT,
  itemId,
  lineAt,
  later,
  lineId,
  OTHER_KEY,
  OTHER_ROOM_ID,
  OWNER_KEY,
  ROOM_ID,
  roleIdOf,
  setUpWatchParty,
} from './watch-party-fixtures';
import { describeWatchPartyRoomClockContract } from './watch-party-room-clock.contract';
import { describeWatchPartyRoomOwnershipContract } from './watch-party-room-ownership.contract';

export function describeWatchPartyRoomRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('WatchPartyRoomRepository contract', () => {
    const party = setUpWatchParty(makeSubject);
    const rooms = () => party.subject.repositories.watchPartyRooms;
    const roles = () => party.subject.repositories.watchPartyRoles;
    const current = party.room;

    it('creates the room with its roles, owner seat and queue in order', async () => {
      const { repositories } = party.subject;
      const created = await party.createRoom({ videoIds: [VIDEO_IDS.a, VIDEO_IDS.b] });

      expect(created).toMatchObject({
        id: ROOM_ID,
        ownerKey: OWNER_KEY,
        status: 'open',
        phase: 'lobby',
        playbackVersion: 0,
        rolesVersion: 0,
        version: 1,
        queueLength: 2,
        currentVideoId: VIDEO_IDS.a,
        presentCount: 0,
      });
      expect(expectOk(await rooms().findById(ROOM_ID))).toEqual(created);

      const listed = expectOk(await roles().list(ROOM_ID, AT));
      expect(listed).toHaveLength(11);
      expect(listed[0]).toMatchObject({ id: roleIdOf('owner'), key: 'owner' });
      expect(listed.find(({ key }) => key === 'member')?.permissions).toContain('chat.post');
      expect(expectOk(await repositories.watchPartyMembers.find(ROOM_ID, OWNER_KEY))).toMatchObject(
        {
          joinedVia: 'owner',
          leftAt: null,
        }
      );
      const { items } = expectOk(await repositories.watchPartyQueue.list(ROOM_ID));
      expect(items.map(({ id, position }) => ({ id, position }))).toEqual([
        { id: itemId(1), position: 0 },
        { id: itemId(2), position: POSITION_GAP },
      ]);
    });

    it('counts and lists only the owner’s open rooms, newest first', async () => {
      const newest = '00000000-0000-7000-8000-00000000e004';
      await party.createRoom();
      await party.createRoom({ id: OTHER_ROOM_ID });
      await party.createRoom({ id: newest });
      await party.createRoom({ id: '00000000-0000-7000-8000-00000000e003', ownerKey: OTHER_KEY });
      expectOk(await rooms().close(OTHER_ROOM_ID, 'owner', null, AT));

      expect(expectOk(await rooms().countOpenOwnedBy(OWNER_KEY))).toBe(2);
      expect(expectOk(await rooms().listOpenOwnedBy(OWNER_KEY)).map(({ id }) => id)).toEqual([
        newest,
        ROOM_ID,
      ]);
      expect(expectOk(await rooms().findById('00000000-0000-7000-8000-00000000e0ff'))).toBeNull();
    });

    describe('settings', () => {
      beforeEach(async () => {
        await party.createRoom();
      });

      it.each([
        {
          scenario: 'applies at the current version and writes its line',
          roomId: ROOM_ID,
          expectedVersion: 1,
          expected: { type: 'applied', room: { name: 'Renamed', slowModeSeconds: 5, version: 2 } },
          lines: [lineId(1)],
        },
        {
          scenario: 'refuses an older version with the current room',
          roomId: ROOM_ID,
          expectedVersion: 0,
          expected: { type: 'stale', room: { name: 'Movie night', version: 1 } },
          lines: [],
        },
        {
          scenario: 'answers missing for an unknown room',
          roomId: OTHER_ROOM_ID,
          expectedVersion: 1,
          expected: { type: 'missing' },
          lines: [],
        },
      ])('$scenario', async ({ roomId, expectedVersion, expected, lines }) => {
        const write = expectOk(
          await rooms().updateSettings(
            roomId,
            { name: 'Renamed', slowModeSeconds: 5 },
            expectedVersion,
            lineAt(1),
            AT
          )
        );

        expect(write).toMatchObject(expected);
        expect(await party.lineIds()).toEqual(lines);
      });

      it('sets and clears the password hash', async () => {
        expectOk(await rooms().updateSettings(ROOM_ID, { passwordHash: 'hash' }, 1, null, AT));
        expect((await current()).passwordHash).toBe('hash');

        expectOk(await rooms().updateSettings(ROOM_ID, { passwordHash: null }, 2, null, AT));
        expect(await current()).toMatchObject({ passwordHash: null, version: 3 });
      });
    });

    describe('closing and presence', () => {
      beforeEach(async () => {
        await party.createRoom();
      });

      it('closes an open room once, writing its line, and calls a second close stale', async () => {
        const first = expectOk(await rooms().close(ROOM_ID, 'owner', lineAt(1), later(1)));
        const second = expectOk(await rooms().close(ROOM_ID, 'idle', lineAt(2), later(2)));

        expect(first).toMatchObject({
          type: 'applied',
          room: { status: 'closed', closedReason: 'owner', closedAt: later(1) },
        });
        expect(second).toMatchObject({
          type: 'stale',
          room: { closedReason: 'owner', closedAt: later(1) },
        });
        expect(await party.lineIds()).toEqual([lineId(1)]);
      });

      it.each([
        { scenario: 'someone was there', counts: [3], presentCount: 3, lastPresentAt: AT },
        { scenario: 'nobody ever was', counts: [0], presentCount: 0, lastPresentAt: null },
        { scenario: 'everyone then left', counts: [3, 0], presentCount: 0, lastPresentAt: AT },
      ])('records presence when $scenario', async ({ counts, presentCount, lastPresentAt }) => {
        for (const [index, present] of counts.entries()) {
          expectOk(await rooms().recordPresence(ROOM_ID, present, later(index * 10)));
        }

        expect(await current()).toMatchObject({ presentCount, lastPresentAt });
      });
    });

    describeWatchPartyRoomClockContract(makeSubject);
    describeWatchPartyRoomOwnershipContract(makeSubject);
  });
}

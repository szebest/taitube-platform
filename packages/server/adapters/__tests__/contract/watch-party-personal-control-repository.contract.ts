import { NO_PERSONAL_CONTROL, type PersonalControlRecord } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OWNER_ID } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import {
  accountId,
  AT,
  createRoom,
  OTHER_ROOM_ID,
  ROOM_ID,
  seedRoomWorld,
  userKey,
} from './watch-party-activity-fixtures';

const INVITER_KEY = userKey(accountId(3));

function control(overrides: Partial<PersonalControlRecord> = {}): PersonalControlRecord {
  return {
    ...NO_PERSONAL_CONTROL,
    userId: OWNER_ID,
    targetKey: INVITER_KEY,
    roomId: null,
    voiceMuted: true,
    updatedAt: AT,
    ...overrides,
  };
}

const targetsOf = (rows: readonly PersonalControlRecord[]) =>
  rows.map((row) => row.targetKey).sort();

export function describeWatchPartyPersonalControlRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('WatchPartyPersonalControlRepository contract', () => {
    let subject: RepositoriesSubject;

    const controls = () => subject.repositories.watchPartyControls;
    const put = async (record: PersonalControlRecord) => expectOk(await controls().put(record));
    const list = async (roomId: string | null = null) =>
      expectOk(await controls().list(OWNER_ID, roomId));

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
    });

    it.each([
      { scenario: 'no room', roomId: null, targets: ['everywhere'] },
      { scenario: 'a room', roomId: ROOM_ID, targets: ['everywhere', 'in-room'] },
      { scenario: 'another room', roomId: OTHER_ROOM_ID, targets: ['elsewhere', 'everywhere'] },
    ])("lists the viewer's everywhere controls and those of $scenario", async (row) => {
      await put(control({ targetKey: 'everywhere' }));
      await put(control({ targetKey: 'in-room', roomId: ROOM_ID }));
      await put(control({ targetKey: 'elsewhere', roomId: OTHER_ROOM_ID }));
      await put(control({ targetKey: 'someone-elses', userId: accountId(4) }));

      expect(targetsOf(await list(row.roomId))).toEqual(row.targets);
    });

    it.each([
      { scope: 'everywhere', roomId: null },
      { scope: 'a room', roomId: ROOM_ID },
    ])('upserts one row per user, target and $scope', async ({ roomId }) => {
      await put(control({ roomId }));
      const changed = control({
        roomId,
        voiceMuted: false,
        hideAvatar: true,
        volume: 50,
        updatedAt: new Date(AT.getTime() + 1_000),
      });

      await put(changed);

      expect(await list(roomId)).toEqual([changed]);
    });

    it('deletes the row of a control that chooses nothing, in its own scope only', async () => {
      await put(control());
      await put(control({ roomId: ROOM_ID }));

      await put(control({ roomId: ROOM_ID, ...NO_PERSONAL_CONTROL }));
      await put(control({ targetKey: 'never-stored', ...NO_PERSONAL_CONTROL }));

      expect(await list(ROOM_ID)).toEqual([control()]);
    });

    it.each([
      { change: 'a stored control', record: control({ roomId: ROOM_ID }) },
      { change: 'a control that chooses nothing', record: control({ ...NO_PERSONAL_CONTROL }) },
    ])('announces $change as one party.controls.updated event of its owner', async ({ record }) => {
      await put(record);

      const events = expectOk(await subject.repositories.userEvents.listFrom(OWNER_ID, 1, 10));

      expect(events.map(({ userId, type, payload }) => ({ userId, type, payload }))).toEqual([
        {
          userId: OWNER_ID,
          type: 'party.controls.updated',
          payload: { targetKey: INVITER_KEY, roomId: record.roomId },
        },
      ]);
    });

    it('answers who blocks invites from an inviter everywhere', async () => {
      const blocker = accountId(4);
      const roomOnly = accountId(5);
      const otherInviter = accountId(6);
      const notBlocking = accountId(7);
      await put(control({ userId: blocker, blockInvites: true }));
      await put(control({ userId: roomOnly, blockInvites: true, roomId: ROOM_ID }));
      await put(control({ userId: otherInviter, blockInvites: true, targetKey: 'user:other' }));
      await put(control({ userId: notBlocking }));

      const blocking = expectOk(
        await controls().blockingInvitesFrom(INVITER_KEY, [
          blocker,
          roomOnly,
          otherInviter,
          notBlocking,
          accountId(8),
        ])
      );

      expect([...blocking]).toEqual([blocker]);
      expect(expectOk(await controls().blockingInvitesFrom(INVITER_KEY, []))).toEqual(new Set());
    });
  });
}

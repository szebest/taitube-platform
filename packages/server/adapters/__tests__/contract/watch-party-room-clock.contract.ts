import { expectOk } from '@vp/testing/result';
import { VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject } from './subjects';
import {
  AT,
  customRole,
  itemId,
  lineAt,
  lineId,
  later,
  OTHER_ROOM_ID,
  ROOM_ID,
  rolesChange,
  setUpWatchParty,
} from './watch-party-fixtures';

export function describeWatchPartyRoomClockContract(makeSubject: MakeRepositoriesSubject): void {
  describe('WatchPartyRoomRepository room clock contract', () => {
    const party = setUpWatchParty(makeSubject);
    const rooms = () => party.subject.repositories.watchPartyRooms;
    const roles = () => party.subject.repositories.watchPartyRoles;
    const current = party.room;

    const commit = (
      overrides: { roomId?: string; playbackVersion?: number; rolesVersion?: number } = {},
      at = AT
    ) =>
      rooms().commitPlayback(overrides.roomId ?? ROOM_ID, {
        expected: {
          playbackVersion: overrides.playbackVersion ?? 0,
          rolesVersion: overrides.rolesVersion ?? 0,
        },
        playback: {
          itemId: null,
          phase: 'playing',
          positionMs: 0,
          rate: 1,
          anchorAt: at.getTime(),
        },
        line: null,
        at,
      });

    describe('the room clock', () => {
      beforeEach(async () => {
        await party.createRoom({ videoIds: [VIDEO_IDS.a, VIDEO_IDS.b] });
      });

      it('applies a command at the versions it saw, moving the phase column with it', async () => {
        const write = expectOk(await commit());

        expect(write).toMatchObject({
          type: 'applied',
          room: { phase: 'playing', playbackVersion: 1, startedAt: AT, updatedAt: AT },
        });
        expect(await current()).toMatchObject({ playback: { phase: 'playing' }, phase: 'playing' });
      });

      it('keeps the first start time across later plays', async () => {
        expectOk(await commit());
        expectOk(await commit({ playbackVersion: 1 }, later(5)));

        expect(await current()).toMatchObject({ playbackVersion: 2, startedAt: AT });
      });

      it('moves to the next item, marking the one it left as played', async () => {
        const write = expectOk(
          await rooms().commitPlayback(ROOM_ID, {
            expected: { playbackVersion: 0, rolesVersion: 0 },
            playback: { itemId: itemId(2), phase: 'playing', positionMs: 0, rate: 1, anchorAt: 0 },
            playedItemId: itemId(1),
            currentVideoId: VIDEO_IDS.b,
            line: lineAt(1),
            at: later(2),
          })
        );

        expect(write).toMatchObject({ type: 'applied', room: { currentVideoId: VIDEO_IDS.b } });
        const { items } = expectOk(await party.subject.repositories.watchPartyQueue.list(ROOM_ID));
        expect(items.map(({ playedAt }) => playedAt)).toEqual([later(2), null]);
        expect(await party.lineIds()).toEqual([lineId(1)]);
      });

      it.each([
        {
          scenario: 'an earlier command already moved the clock',
          prepare: async () => {
            expectOk(await commit());
          },
        },
        {
          scenario: 'a role changed since the command read the room',
          prepare: async () => {
            expectOk(await roles().create(customRole(), rolesChange(1)));
          },
        },
        {
          scenario: 'the room is closed',
          prepare: async () => {
            expectOk(await rooms().close(ROOM_ID, 'owner', null, AT));
          },
        },
      ])('is stale when $scenario', async ({ prepare }) => {
        await prepare();
        const before = await current();

        const write = expectOk(await commit());

        expect(write).toEqual({ type: 'stale', room: before });
      });

      it('answers missing for an unknown room', async () => {
        expect(expectOk(await commit({ roomId: OTHER_ROOM_ID }))).toEqual({ type: 'missing' });
      });

      it('lets exactly one of two commands from the same versions win', async () => {
        const writes = await Promise.all([commit(), commit({}, later(1))]);

        expect(writes.map((write) => expectOk(write).type).sort()).toEqual(['applied', 'stale']);
        expect((await current()).playbackVersion).toBe(1);
      });
    });
  });
}

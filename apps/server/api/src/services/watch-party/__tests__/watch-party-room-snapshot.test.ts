import { expectOk } from '@vp/testing/result';
import { roomSnapshot, seatedRoster } from '../watch-party-room-snapshot';
import { keyOf, ROOM_ID, seatGuest } from './watch-party-moderation-fixture';
import { socketRoom } from './watch-party-socket-fixture';
import { MEMBER, OWNER, userCaller } from './watch-party-test-deps';

async function contextOf(party: Awaited<ReturnType<typeof socketRoom>>, who = MEMBER) {
  return expectOk(await party.deps.context.load(ROOM_ID, userCaller(who)));
}

describe('the room snapshot', () => {
  it('opens a socket with the room, the caller, the clock, the queue and the chat mode', async () => {
    const party = await socketRoom();
    const room = await party.play(2_000);

    const { hello, lines } = expectOk(
      await roomSnapshot(party.deps, await contextOf(party), keyOf(MEMBER), null)
    );

    expect(hello).toMatchObject({
      room: { id: ROOM_ID },
      you: { memberKey: keyOf(MEMBER), kind: 'user', roleIds: [] },
      playback: { phase: 'playing', positionMs: 2_000 },
      version: room.playbackVersion,
      rolesVersion: room.rolesVersion,
      serverNow: party.deps.now().getTime(),
      chat: { resume: 'fresh', mode: { enabled: true, slowModeSeconds: 0 }, pinned: null },
    });
    expect(hello.roles).toHaveLength(11);
    expect(hello.queue.items).toHaveLength(2);
    expect(lines.every(({ kind }) => kind === 'system')).toBe(true);
  });

  it.each([
    { who: 'the owner, who may remove guests', user: OWNER, entries: 3, guests: 0 },
    { who: 'a member, who may not', user: MEMBER, entries: 2, guests: 1 },
  ])('lists guests one by one only to $who', async ({ user, entries, guests }) => {
    const party = await socketRoom({ preset: 'public' });
    await seatGuest(party.repositories, party.deps.now());

    const roster = expectOk(await seatedRoster(party.deps, await contextOf(party, user)));

    expect([roster.entries.length, roster.guests]).toEqual([entries, guests]);
  });
});

import type { WatchPartyRoom } from '@vp/domain';
import { MS_PER_DAY, MS_PER_MINUTE } from '@vp/domain/time';
import { expectOk } from '@vp/testing/result';
import { idleCloseReason, WatchPartySweep } from '../watch-party-sweep';
import { keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import { socketRoom } from './watch-party-socket-fixture';
import { MEMBER, OWNER, START } from './watch-party-test-deps';

type Party = Awaited<ReturnType<typeof socketRoom>>;

const GRACE_MS = 60_000;
const HOUR_MS = 60 * MS_PER_MINUTE;

async function present(party: Party, ...keys: string[]) {
  for (const key of keys) {
    const nowMs = party.deps.now().getTime();
    expectOk(await party.presence.admit(ROOM_ID, key, { limit: null, nowMs, staleBeforeMs: 0 }));
  }
}

const roomWith = (overrides: Partial<WatchPartyRoom>) => ({
  idleClose: '15m' as const,
  scheduledFor: null,
  lastPresentAt: new Date(START) as Date | null,
  createdAt: new Date(START),
  startedAt: new Date(START) as Date | null,
  ...overrides,
});

describe('idleCloseReason', () => {
  it.each([
    { scenario: 'under the idle time', room: {}, after: 14 * MS_PER_MINUTE, reason: null },
    { scenario: 'past the idle time', room: {}, after: 15 * MS_PER_MINUTE, reason: 'idle' },
    {
      scenario: 'past it and never started',
      room: { startedAt: null },
      after: 15 * MS_PER_MINUTE,
      reason: 'not_started',
    },
    {
      scenario: 'never present, counted from its creation',
      room: { lastPresentAt: null },
      after: 15 * MS_PER_MINUTE,
      reason: 'idle',
    },
    {
      scenario: 'a persistent room',
      room: { idleClose: 'never' as const },
      after: 400 * MS_PER_DAY,
      reason: null,
    },
    {
      scenario: 'a scheduled room before its hour of grace is out',
      room: { scheduledFor: new Date(START + 2 * HOUR_MS), lastPresentAt: null },
      after: 3 * HOUR_MS - 1,
      reason: null,
    },
    {
      scenario: 'a scheduled room past its hour of grace',
      room: { scheduledFor: new Date(START + 2 * HOUR_MS), lastPresentAt: null, startedAt: null },
      after: 3 * HOUR_MS,
      reason: 'not_started',
    },
  ])('answers $reason for $scenario', ({ room, after, reason }) => {
    expect(idleCloseReason(roomWith(room), START + after, HOUR_MS)).toBe(reason);
  });
});

describe('the watch party sweep', () => {
  const sweepOf = (party: Party) => new WatchPartySweep(party.deps);

  it('records who is present and leaves a room with people in it open', async () => {
    const party = await socketRoom();
    await present(party, keyOf(OWNER));
    party.clock.advance(HOUR_MS);
    await present(party, keyOf(OWNER));

    const outcome = expectOk(await sweepOf(party).run());

    expect(outcome).toMatchObject({ rooms: 1, closed: 0 });
    expect(await party.room()).toMatchObject({ status: 'open', presentCount: 1 });
  });

  it('closes a room nobody has been in for its idle time and tells the sockets', async () => {
    const party = await socketRoom();
    party.clock.advance(16 * MS_PER_MINUTE);

    const outcome = expectOk(await sweepOf(party).run());

    expect(outcome).toMatchObject({ closed: 1 });
    expect(await party.room()).toMatchObject({ status: 'closed', closedReason: 'not_started' });
    expect(party.published('closed')).toEqual([{ type: 'closed', reason: 'not_started' }]);
  });

  it('passes ownership on only after the owner has been away for the grace', async () => {
    const party = await socketRoom();
    const sweep = sweepOf(party);
    await present(party, keyOf(MEMBER));

    expect(expectOk(await sweep.run())).toMatchObject({ handedOver: 0 });
    party.clock.advance(GRACE_MS - 1);
    await present(party, keyOf(MEMBER));
    expect(expectOk(await sweep.run())).toMatchObject({ handedOver: 0 });
    expect((await party.room()).ownerKey).toBe(keyOf(OWNER));

    party.clock.advance(1);
    await present(party, keyOf(MEMBER));
    expect(expectOk(await sweep.run())).toMatchObject({ handedOver: 1 });
    expect((await party.room()).ownerKey).toBe(keyOf(MEMBER));
  });

  it('forgets an absent owner who came back', async () => {
    const party = await socketRoom();
    const sweep = sweepOf(party);
    await present(party, keyOf(MEMBER));
    expectOk(await sweep.run());
    party.clock.advance(GRACE_MS);
    await present(party, keyOf(MEMBER), keyOf(OWNER));
    expectOk(await sweep.run());
    party.clock.advance(1);
    await present(party, keyOf(MEMBER));

    expect(expectOk(await sweep.run())).toMatchObject({ handedOver: 0 });
    expect((await party.room()).ownerKey).toBe(keyOf(OWNER));
  });

  it('drops the rooms closed past their retention', async () => {
    const party = await socketRoom();
    expectOk(
      await party.repositories.watchPartyRooms.close(ROOM_ID, 'owner', null, new Date(START))
    );
    party.clock.advance(31 * MS_PER_DAY);

    const outcome = expectOk(await sweepOf(party).run());

    expect(outcome.purgedRooms).toBe(1);
    expect(expectOk(await party.repositories.watchPartyRooms.findById(ROOM_ID))).toBeNull();
  });

  it('drops the chat lines past their retention from a room that stays open', async () => {
    const party = await socketRoom();
    await present(party, keyOf(OWNER));
    const lines = party.repositories.watchPartyMessages;
    expectOk(
      await lines.append({
        id: party.deps.secrets.newId(),
        roomId: ROOM_ID,
        authorKey: keyOf(OWNER),
        source: 'app',
        kind: 'text',
        body: 'old',
        system: null,
        videoId: null,
        positionMs: null,
        createdAt: new Date(START),
      })
    );
    party.clock.advance(8 * MS_PER_DAY);
    await present(party, keyOf(OWNER));

    const outcome = expectOk(await sweepOf(party).run());

    expect(outcome.purgedMessages).toBe(1);
    expect(expectOk(await lines.listAfter(ROOM_ID, null, 10))).toEqual([]);
  });
});

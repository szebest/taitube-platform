import { MS_PER_MINUTE } from '@kit/primitives';
import { ok } from '@kit/result';
import { expectOk } from '@kit/testing/result';
import { dueToAutoStart, missedStart, startOrExpire } from '../watch-party-scheduled-start';
import { WatchPartySweep } from '../watch-party-sweep';
import { keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import { socketRoom } from './watch-party-socket-fixture';
import { OWNER, START } from './watch-party-test-deps';

type Party = Awaited<ReturnType<typeof socketRoom>>;

const HOUR_MS = 60 * MS_PER_MINUTE;
const sweepOf = (party: Party) => new WatchPartySweep(party.deps);

async function present(party: Party, ...keys: string[]) {
  for (const key of keys) {
    const nowMs = party.deps.now().getTime();
    expectOk(await party.presence.admit(ROOM_ID, key, { limit: null, nowMs, staleBeforeMs: 0 }));
  }
}

describe('scheduled rooms', () => {
  const TEN_MINUTES = 10 * MS_PER_MINUTE;

  it.each([
    {
      scenario: 'before its time',
      autoStart: true,
      phase: 'lobby',
      after: TEN_MINUTES - 1,
      due: false,
    },
    { scenario: 'at its time', autoStart: true, phase: 'lobby', after: TEN_MINUTES, due: true },
    {
      scenario: 'at its time with auto start off',
      autoStart: false,
      phase: 'lobby',
      after: TEN_MINUTES,
      due: false,
    },
    {
      scenario: 'already playing',
      autoStart: true,
      phase: 'playing',
      after: TEN_MINUTES,
      due: false,
    },
  ] as const)('a room $scenario is due to auto start: $due', ({ autoStart, phase, after, due }) => {
    const room = { autoStart, phase, scheduledFor: new Date(START + TEN_MINUTES) };

    expect(dueToAutoStart(room, START + after)).toBe(due);
  });

  it.each([
    { scenario: 'inside the hour of grace', after: HOUR_MS - 1, missed: false },
    { scenario: 'an hour past it', after: HOUR_MS, missed: true },
  ])('a lobby $scenario has missed its start: $missed', ({ after, missed }) => {
    const room = { scheduledFor: new Date(START), startedAt: null, phase: 'lobby' as const };

    expect(missedStart(room, START + after, HOUR_MS)).toBe(missed);
  });

  describe('swept', () => {
    const setUp = async (autoStart: boolean) => {
      const party = await socketRoom();
      const room = await party.room();
      expectOk(
        await party.deps.repositories.watchPartyRooms.updateSettings(
          ROOM_ID,
          { scheduledFor: new Date(START + TEN_MINUTES), autoStart },
          room.version,
          null,
          party.deps.now()
        )
      );
      return party;
    };

    it.each([
      { scenario: 'someone is present', autoStart: true, here: true, phase: 'playing' },
      { scenario: 'nobody is present', autoStart: true, here: false, phase: 'lobby' },
      { scenario: 'auto start is off', autoStart: false, here: true, phase: 'lobby' },
    ])('at its time with $scenario the room is $phase', async ({ autoStart, here, phase }) => {
      const party = await setUp(autoStart);
      party.clock.advance(TEN_MINUTES);
      if (here) await present(party, keyOf(OWNER));

      expectOk(await sweepOf(party).run());

      expect((await party.room()).phase).toBe(phase);
      expect(party.published('state')).toHaveLength(phase === 'playing' ? 1 : 0);
    });

    it('lets an edit made after the sweep read the room win over the page it holds', async () => {
      const party = await setUp(true);
      const page = await party.room();
      expectOk(
        await party.deps.repositories.watchPartyRooms.updateSettings(
          ROOM_ID,
          { autoStart: false },
          page.version,
          null,
          party.deps.now()
        )
      );
      party.clock.advance(TEN_MINUTES);
      const close = async () => ok('kept' as const);

      const outcome = await startOrExpire(party.deps, page, 1, party.deps.now().getTime(), close);

      expect(expectOk(outcome)).toBe('kept');
      expect((await party.room()).phase).toBe('lobby');
    });

    it('closes a room nobody started within the hour, with people waiting in it', async () => {
      const party = await setUp(false);
      party.clock.advance(TEN_MINUTES + HOUR_MS);
      await present(party, keyOf(OWNER));

      expect(expectOk(await sweepOf(party).run())).toMatchObject({ closed: 1 });

      expect(await party.room()).toMatchObject({ status: 'closed', closedReason: 'not_started' });
    });
  });
});

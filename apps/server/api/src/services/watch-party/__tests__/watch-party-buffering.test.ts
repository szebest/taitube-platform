import { expectOk } from '@vp/testing/result';
import { BufferingWait } from '../watch-party-buffering';
import { keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import { elapse, fakeTimers, socketRoom } from './watch-party-socket-fixture';
import { MEMBER } from './watch-party-test-deps';

type Party = Awaited<ReturnType<typeof socketRoom>>;

async function crowd(party: Party, count: number) {
  const nowMs = party.deps.now().getTime();
  for (let index = 0; index < count; index += 1) {
    expectOk(
      await party.presence.admit(ROOM_ID, `user:present-${index}`, {
        limit: null,
        nowMs,
        staleBeforeMs: 0,
      })
    );
  }
}

async function bufferingRoom(options: { present?: number; policy?: 'wait' | 'continue' } = {}) {
  const party = await socketRoom();
  if (options.policy === 'continue') {
    const room = await party.room();
    expectOk(
      await party.repositories.watchPartyRooms.updateSettings(
        ROOM_ID,
        { bufferPolicy: 'continue' },
        room.version,
        null,
        party.deps.now()
      )
    );
  }
  await crowd(party, options.present ?? 2);
  await party.play();
  return { party, wait: new BufferingWait(party.deps) };
}

const reasons = (party: Party) =>
  party.published('state').map(({ playback, reason }) => `${reason}:${playback.phase}`);

describe('BufferingWait', () => {
  beforeEach(() => {
    fakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pauses a small room once a member buffers 1.5 s, and plays on when they stop', async () => {
    const { party, wait } = await bufferingRoom();

    wait.start(ROOM_ID, keyOf(MEMBER));
    await elapse(1_499);
    const before = reasons(party);
    await elapse(1);
    wait.stop(ROOM_ID, keyOf(MEMBER));
    await elapse(0);

    expect(before).toEqual([]);
    expect(reasons(party)).toEqual(['buffering:paused', 'buffering:playing']);
  });

  it('plays on after 10 s whoever still buffers', async () => {
    const { party, wait } = await bufferingRoom();

    wait.start(ROOM_ID, keyOf(MEMBER));
    await elapse(1_500);
    await elapse(10_000);

    expect(reasons(party)).toEqual(['buffering:paused', 'buffering:playing']);
  });

  it('never waits for a short buffer', async () => {
    const { party, wait } = await bufferingRoom();

    wait.start(ROOM_ID, keyOf(MEMBER));
    await elapse(1_000);
    wait.stop(ROOM_ID, keyOf(MEMBER));
    await elapse(5_000);

    expect(reasons(party)).toEqual([]);
  });

  it.each([
    { scenario: 'with 13 present', present: 13, policy: 'wait' as const },
    { scenario: 'with the continue policy', present: 2, policy: 'continue' as const },
  ])('never pauses the room $scenario', async ({ present, policy }) => {
    const { party, wait } = await bufferingRoom({ present, policy });

    wait.start(ROOM_ID, keyOf(MEMBER));
    await elapse(12_000);

    expect(reasons(party)).toEqual([]);
  });

  it('leaves a room someone else moved during the wait as they left it', async () => {
    const { party, wait } = await bufferingRoom();
    wait.start(ROOM_ID, keyOf(MEMBER));
    await elapse(1_500);

    await party.play(30_000);
    wait.stop(ROOM_ID, keyOf(MEMBER));
    await elapse(0);

    expect(reasons(party)).toEqual([]);
  });
});

import type { WatchPartyServerFrame } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { getWatchPartyPermissions, toWatchPartyViewer } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { answerFrame, type FrameSender, readFrame } from '../watch-party-frames';
import { keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import { socketRoom } from './watch-party-socket-fixture';
import { MEMBER, userCaller } from './watch-party-test-deps';

function senderOf(overrides: Partial<FrameSender> = {}) {
  const direct: WatchPartyServerFrame[] = [];
  const patches: unknown[] = [];
  const sender: FrameSender = {
    roomId: ROOM_ID,
    caller: userCaller(MEMBER),
    memberKey: keyOf(MEMBER),
    guest: false,
    ability: getWatchPartyPermissions(null, toWatchPartyViewer(null)),
    direct: (frame) => direct.push(frame),
    patch: (change) => patches.push(change),
    ...overrides,
  };
  return { sender, direct, patches };
}

describe('room frames', () => {
  it.each([
    {
      scenario: 'a frame past the size limit',
      raw: JSON.stringify({ type: 'clock', t0: 1, pad: 'x'.repeat(64) }),
    },
    { scenario: 'text that is not JSON', raw: '{' },
    { scenario: 'a type outside the contract', raw: JSON.stringify({ type: 'dance' }) },
  ])('refuses $scenario as unreadable', ({ raw }) => {
    expect(expectErr(readFrame(raw, 48))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      reason: 'unreadable',
    });
  });

  it('reads a frame inside the contract', () => {
    expect(expectOk(readFrame(JSON.stringify({ type: 'clock', t0: 5, ref: 'r' }), 4096))).toEqual({
      type: 'clock',
      t0: 5,
      ref: 'r',
    });
  });

  it('answers a clock ping with the server’s time', async () => {
    const { socketDeps, deps } = await socketRoom();

    const answer = await answerFrame(socketDeps, senderOf().sender, { type: 'clock', t0: 7 });

    expect(expectOk(answer)).toEqual({ type: 'clock', t0: 7, serverNow: deps.now().getTime() });
  });

  it.each([
    { frame: { type: 'ready', ready: true }, change: { ready: true } },
    { frame: { type: 'away', away: true }, change: { away: true } },
    { frame: { type: 'buffering', buffering: true }, change: { sync: 'buffering' } },
    { frame: { type: 'buffering', buffering: false }, change: { sync: 'in_sync' } },
  ] as const)('patches the sender’s roster entry for $frame.type', async ({ frame, change }) => {
    const { socketDeps } = await socketRoom();
    const { sender, patches } = senderOf();

    const answer = await answerFrame(socketDeps, sender, { ...frame, ref: 'r1' });

    expect(expectOk(answer)).toEqual({ type: 'ack', ref: 'r1' });
    expect(patches).toEqual([change]);
  });

  it.each([
    { who: 'a member', guest: false, waits: 1 },
    { who: 'a guest', guest: true, waits: 0 },
  ])('starts the buffering wait for $who only', async ({ guest, waits }) => {
    const { socketDeps } = await socketRoom();
    const start = vi.spyOn(socketDeps.buffering, 'start');

    await answerFrame(socketDeps, senderOf({ guest }).sender, {
      type: 'buffering',
      buffering: true,
    });

    expect(start).toHaveBeenCalledTimes(waits);
  });

  it('acknowledges drift stats', async () => {
    const { socketDeps } = await socketRoom();

    const answer = await answerFrame(socketDeps, senderOf().sender, {
      type: 'stats',
      ref: 's',
      driftMs: 120,
      hardSeeks: 0,
    });

    expect(expectOk(answer)).toEqual({ type: 'ack', ref: 's' });
  });
});

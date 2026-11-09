import type { WatchPartyServerFrame } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { getWatchPartyPermissions, toWatchPartyViewer } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { answerFrame, type FrameSender, readFrame } from '../watch-party-frames';
import { keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import { socketRoom } from './watch-party-socket-fixture';
import { MEMBER, OWNER, reading, userCaller } from './watch-party-test-deps';

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

  it('acknowledges drift stats and records the drift and the hard seeks', async () => {
    const { socketDeps, metrics } = await socketRoom();

    const answer = await answerFrame(socketDeps, senderOf().sender, {
      type: 'stats',
      ref: 's',
      driftMs: 120,
      hardSeeks: 3,
    });

    expect(expectOk(answer)).toEqual({ type: 'ack', ref: 's' });
    expect(await reading(metrics.watchPartyHardSeeksTotal)).toBe(3);
    expect(await reading(metrics.watchPartyDriftSeconds)).toBeGreaterThan(0);
  });

  it.each([
    { scenario: 'a pause the room accepts', owner: true, version: 0, result: 'applied' },
    { scenario: 'a pause from stale versions', owner: true, version: 99, result: 'stale' },
    { scenario: 'a pause without playback.control', owner: false, version: 0, result: 'forbidden' },
  ])('counts $scenario as $result', async ({ owner, version, result }) => {
    const party = await socketRoom({ preset: 'public' });
    await party.play();
    const room = await party.room();
    const user = owner ? OWNER : MEMBER;
    const { sender } = senderOf({
      caller: userCaller(user),
      memberKey: keyOf(user),
    });

    await answerFrame(party.socketDeps, sender, {
      type: 'pause',
      positionMs: 1_000,
      version: version === 0 ? room.playbackVersion : version,
      rolesVersion: room.rolesVersion,
    });

    expect(await reading(party.metrics.watchPartyCommandsTotal, { command: 'pause', result })).toBe(
      1
    );
  });

  it('counts a refused permission against the permission and the kind that lacked it', async () => {
    const party = await socketRoom({ preset: 'public' });
    const room = await party.room();

    await answerFrame(party.socketDeps, senderOf().sender, {
      type: 'play',
      version: room.playbackVersion,
      rolesVersion: room.rolesVersion,
    });

    expect(
      await reading(party.metrics.watchPartyPermissionDenialsTotal, {
        permission: 'playback.control',
        kind: 'user',
      })
    ).toBe(1);
  });

  it.each([
    { text: 'hello', outcome: 'sent' },
    { text: '   ', outcome: 'refused' },
  ])('counts a chat line that is $outcome', async ({ text, outcome }) => {
    const party = await socketRoom();

    await answerFrame(party.socketDeps, senderOf().sender, {
      type: 'chat.send',
      message: text,
    });

    expect(
      await reading(party.metrics.watchPartyChatMessagesTotal, { source: 'app', outcome })
    ).toBe(1);
  });
});

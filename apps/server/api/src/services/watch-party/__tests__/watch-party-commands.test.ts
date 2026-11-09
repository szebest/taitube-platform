import type { WatchPartyServerFrame } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { type CommandFrame, runCommand } from '../watch-party-commands';
import { keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import { socketRoom } from './watch-party-socket-fixture';
import { MEMBER, OWNER, userCaller } from './watch-party-test-deps';

type Party = Awaited<ReturnType<typeof socketRoom>>;
type Bare<F = CommandFrame> = F extends unknown ? Omit<F, 'version' | 'rolesVersion'> : never;

async function send(party: Party, frame: Bare, who = OWNER) {
  const room = await party.room();
  const direct: WatchPartyServerFrame[] = [];
  const result = await runCommand(
    party.deps,
    ROOM_ID,
    userCaller(who),
    {
      ...frame,
      version: room.playbackVersion,
      rolesVersion: room.rolesVersion,
    } as CommandFrame,
    (sent) => direct.push(sent)
  );
  return { result, direct };
}

describe('runCommand', () => {
  it.each([
    { command: { type: 'pause', positionMs: 5_000 }, phase: 'paused', positionMs: 5_000 },
    { command: { type: 'seek', positionMs: 9_000 }, phase: 'playing', positionMs: 9_000 },
    { command: { type: 'rate', rate: 1.5 }, phase: 'playing', positionMs: 0 },
  ] as const)(
    'applies $command.type as one compare-and-set and publishes the state',
    async ({ command, phase, positionMs }) => {
      const party = await socketRoom();
      const before = await party.play();

      expectOk((await send(party, command)).result);

      const after = await party.room();
      expect(after.playbackVersion).toBe(before.playbackVersion + 1);
      expect(after.playback).toMatchObject({ phase, positionMs });
      expect(party.published('state')).toEqual([
        expect.objectContaining({ by: keyOf(OWNER), reason: 'command' }),
      ]);
    }
  );

  it('starts a lobby with a countdown, and ignores a start once playing', async () => {
    const party = await socketRoom();

    expectOk((await send(party, { type: 'start' })).result);
    expectOk((await send(party, { type: 'start' })).result);

    expect(party.published('countdown')).toHaveLength(1);
    expect((await party.room()).phase).toBe('playing');
  });

  it('refuses old versions as stale and sends the sender the current state first', async () => {
    const party = await socketRoom();
    const before = await party.room();
    await party.play();
    const direct: WatchPartyServerFrame[] = [];

    const result = await runCommand(
      party.deps,
      ROOM_ID,
      userCaller(OWNER),
      {
        type: 'pause',
        positionMs: 0,
        version: before.playbackVersion,
        rolesVersion: before.rolesVersion,
      },
      (frame) => direct.push(frame)
    );

    expect(expectErr(result)).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_STATE_STALE,
      playbackVersion: before.playbackVersion + 1,
    });
    expect(direct).toEqual([expect.objectContaining({ type: 'state' })]);
  });

  it.each([
    { command: { type: 'pause', positionMs: 0 }, permission: 'playback.control' },
    { command: { type: 'next' }, permission: 'queue.skip' },
  ] as const)(
    'refuses $command.type from a public room’s member, naming $permission',
    async ({ command, permission }) => {
      const party = await socketRoom({ preset: 'public' });
      await party.play();

      const { result } = await send(party, command, MEMBER);

      expect(expectErr(result)).toMatchObject({
        code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
        permission,
      });
    }
  );

  it('moves a friends room on to the next item on a member’s next', async () => {
    const party = await socketRoom();
    await party.play();

    expectOk((await send(party, { type: 'next' }, MEMBER)).result);

    expect(party.published('state')[0]).toMatchObject({ reason: 'command' });
    expect((await party.room()).playback.itemId).toBe(party.items[1]?.id);
  });

  it.each([
    { scenario: 'near the end, with autoplay', positionMs: 59_000, itemIndex: 1, phase: 'playing' },
    { scenario: '10 s early', positionMs: 50_000, itemIndex: 0, phase: 'playing' },
  ])('moves on from an ended item $scenario only', async ({ positionMs, itemIndex, phase }) => {
    const party = await socketRoom();
    await party.play(positionMs);

    expectOk(
      (await send(party, { type: 'ended', itemId: party.items[0]?.id ?? '' }, MEMBER)).result
    );

    const after = await party.room();
    expect(after.playback).toMatchObject({ itemId: party.items[itemIndex]?.id, phase });
  });

  it('refuses the seventh command in five seconds', async () => {
    const party = await socketRoom();
    await party.play();

    for (let sent = 0; sent < 6; sent += 1) {
      expectOk((await send(party, { type: 'seek', positionMs: sent })).result);
    }
    const { result } = await send(party, { type: 'seek', positionMs: 7 });

    expect(expectErr(result).code).toBe(ErrorCodes.RATE_LIMITED);
  });
});

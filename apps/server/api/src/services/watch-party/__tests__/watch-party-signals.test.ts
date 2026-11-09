import { ErrorCodes } from '@vp/errors';
import { getWatchPartyPermissions, toWatchPartyViewer } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { foldReactions, react, requestPlayback, voteSkip } from '../watch-party-signals';
import { keyOf, ROOM_ID } from './watch-party-moderation-fixture';
import { socketRoom } from './watch-party-socket-fixture';
import { MEMBER, OTHER, OWNER, userCaller } from './watch-party-test-deps';

const ability = (permissions: Parameters<typeof toWatchPartyViewer>[0]) =>
  getWatchPartyPermissions(null, toWatchPartyViewer(permissions));

const REACTOR = ability({
  kind: 'user',
  isOwner: false,
  effective: { permissions: ['chat.react'], topPosition: 1 },
});

describe('room signals', () => {
  it('folds a window of reactions into totals and per-member counts', () => {
    expect(
      foldReactions([
        { memberKey: 'user:a', emoji: '🔥' },
        { memberKey: 'user:b', emoji: '🔥' },
        { memberKey: 'user:a', emoji: '🔥' },
        { memberKey: 'user:a', emoji: '🎉' },
      ])
    ).toEqual({
      type: 'reactions',
      counts: { '🔥': 3, '🎉': 1 },
      from: [
        { memberKey: 'user:a', emoji: '🔥', count: 2 },
        { memberKey: 'user:b', emoji: '🔥', count: 1 },
        { memberKey: 'user:a', emoji: '🎉', count: 1 },
      ],
    });
  });

  it('gathers a reaction for the pod’s fold, and refuses the eleventh in five seconds', async () => {
    const { deps, socketDeps } = await socketRoom();
    const add = vi.spyOn(socketDeps.reactions, 'add');
    const sent = () =>
      react(deps, socketDeps.reactions, {
        roomId: ROOM_ID,
        memberKey: 'user:a',
        emoji: '🔥',
        ability: REACTOR,
      });

    for (let count = 0; count < 10; count += 1) expectOk(await sent());

    expect(expectErr(await sent()).code).toBe(ErrorCodes.RATE_LIMITED);
    expect(add).toHaveBeenCalledTimes(10);
  });

  it('refuses a reaction without chat.react', async () => {
    const { deps, socketDeps } = await socketRoom();

    const result = await react(deps, socketDeps.reactions, {
      roomId: ROOM_ID,
      memberKey: 'guest:x',
      emoji: '🔥',
      ability: ability({
        kind: 'guest',
        isOwner: false,
        effective: { permissions: [], topPosition: 0 },
      }),
    });

    expect(expectErr(result)).toMatchObject({ permission: 'chat.react' });
  });

  it('sends a request only to the holders of playback.control', async () => {
    const party = await socketRoom({ preset: 'public' });

    expectOk(
      await requestPlayback(party.deps, ROOM_ID, userCaller(MEMBER), {
        type: 'request',
        kind: 'seek',
        positionMs: 754_000,
      })
    );

    expect(party.frames()).toEqual([
      expect.objectContaining({
        audience: 'playback.control',
        frame: { type: 'request', from: keyOf(MEMBER), kind: 'seek', positionMs: 754_000 },
      }),
    ]);
  });

  it('skips once the votes reach the room’s share of present voters', async () => {
    const party = await socketRoom({ preset: 'public', members: [MEMBER, OTHER] });
    await party.play();
    const nowMs = party.deps.now().getTime();
    for (const user of [OWNER, MEMBER, OTHER]) {
      expectOk(
        await party.presence.admit(ROOM_ID, keyOf(user), { limit: null, nowMs, staleBeforeMs: 0 })
      );
    }
    const itemId = party.items[0]?.id ?? '';

    expectOk(await voteSkip(party.deps, ROOM_ID, userCaller(MEMBER), itemId));
    const held = (await party.room()).playback.itemId;
    expectOk(await voteSkip(party.deps, ROOM_ID, userCaller(OTHER), itemId));

    expect(party.published('votes')).toEqual([
      { type: 'votes', itemId, votes: 1, needed: 2 },
      { type: 'votes', itemId, votes: 2, needed: 2 },
    ]);
    expect(held).toBe(itemId);
    expect((await party.room()).playback.itemId).toBe(party.items[1]?.id);
  });
});

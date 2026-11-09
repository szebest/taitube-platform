import { expectOk } from '@vp/testing/result';
import { advanceRoom, commitState, pausedNow, stateFrame } from '../watch-party-playback';
import { ROOM_ID } from './watch-party-moderation-fixture';
import { socketRoom } from './watch-party-socket-fixture';
import { VIDEO_B } from './watch-party-test-deps';

describe('the room clock’s commits', () => {
  it('publishes an applied change as state, with the countdown of a start', async () => {
    const party = await socketRoom();
    const room = await party.room();
    const nowMs = party.deps.now().getTime();

    const written = expectOk(
      await commitState(party.deps, room, {
        playback: { ...room.playback, phase: 'playing', anchorAt: nowMs + 3_000 },
        by: 'user:someone',
        reason: 'command',
      })
    );

    expect(written.type).toBe('applied');
    expect(party.published('state')).toEqual([
      expect.objectContaining({ version: room.playbackVersion + 1, by: 'user:someone' }),
    ]);
    expect(party.published('countdown')).toEqual([{ type: 'countdown', startsAt: nowMs + 3_000 }]);
  });

  it('publishes nothing for a change made on versions the room has moved past', async () => {
    const party = await socketRoom();
    const before = await party.room();
    await party.play();

    const written = expectOk(
      await commitState(party.deps, before, {
        playback: before.playback,
        by: null,
        reason: 'system',
      })
    );

    expect(written.type).toBe('stale');
    expect(party.published('state')).toEqual([]);
  });

  it('advances to the next unplayed item with a now-playing line and the queue as it stands', async () => {
    const party = await socketRoom();
    const room = await party.play(30_000);

    expectOk(await advanceRoom(party.deps, room, null, 'skip'));

    const after = await party.room();
    expect(after.playback).toMatchObject({ itemId: party.items[1]?.id, positionMs: 0 });
    expect(after.currentVideoId).toBe(VIDEO_B);
    expect(party.published('state')[0]).toMatchObject({ reason: 'skip', by: null });
    expect(party.published('queue')[0]?.items[0]?.playedAt).not.toBeNull();
    const lines = expectOk(
      await party.repositories.watchPartyMessages.listAfter(ROOM_ID, null, 10)
    );
    expect(lines.at(-1)?.system).toMatchObject({ event: 'now_playing', detail: VIDEO_B });
  });

  it('finishes the room once the queue has run out', async () => {
    const party = await socketRoom();
    await party.play();
    expectOk(await advanceRoom(party.deps, await party.room(), null, 'advance'));

    expectOk(await advanceRoom(party.deps, await party.room(), null, 'advance'));

    expect((await party.room()).phase).toBe('finished');
  });

  it('holds the room where its clock says it is now', async () => {
    const party = await socketRoom();
    const room = await party.play(1_000);
    const nowMs = party.deps.now().getTime();

    expect(pausedNow(room, nowMs + 2_500)).toMatchObject({
      phase: 'paused',
      positionMs: 3_500,
      anchorAt: nowMs + 2_500,
    });
    expect(stateFrame(room, null, 'system')).toMatchObject({ version: room.playbackVersion });
  });
});

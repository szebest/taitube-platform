import { expectOk } from '@kit/testing/result';
import { joinRoom } from '../watch-party-join';
import { closeRoom } from '../watch-party-settings';
import { elapse, fakeTimers } from './watch-party-socket-fixture';
import {
  MEMBER,
  OWNER,
  seedParty,
  startParty,
  userCaller,
  VIDEO_A,
  VIDEO_UNLISTED,
  watchPartyTestDeps,
} from './watch-party-test-deps';

async function setUp() {
  const test = watchPartyTestDeps();
  await seedParty(test);
  return test;
}

describe('apps/server/api/services: the discovery feed', () => {
  beforeEach(() => {
    fakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces a public room as opened, and nothing for an unlisted one', async () => {
    const test = await setUp();

    await startParty(test, { visibility: 'unlisted', source: { videoId: VIDEO_A } });
    expect(test.discoveryEvents()).toEqual([]);

    const room = await startParty(test, { visibility: 'public', source: { videoId: VIDEO_A } });
    expect(test.discoveryEvents()).toMatchObject([
      { type: 'party.opened', payload: { card: { id: room.id, presentCount: 0 } } },
    ]);
  });

  it('batches a join into one party.counts frame for the window with the present count', async () => {
    const test = await setUp();
    const room = await startParty(test, { visibility: 'public', source: { videoId: VIDEO_A } });
    const memberKey = `user:${MEMBER.id}`;
    expectOk(
      await test.presence.admit(room.id, memberKey, {
        limit: null,
        nowMs: test.clock.nowMs,
        staleBeforeMs: 0,
      })
    );

    expectOk(await joinRoom(test.deps, room.id, userCaller(MEMBER), null));
    expect(test.discoveryEvents().filter(({ type }) => type === 'party.counts')).toEqual([]);

    await elapse(test.deps.config.discovery.countsBatchMs);
    expect(test.discoveryEvents().filter(({ type }) => type === 'party.counts')).toEqual([
      { type: 'party.counts', payload: { counts: [{ id: room.id, presentCount: 1 }] } },
    ]);
  });

  it('sends closed when the room closes', async () => {
    const test = await setUp();
    const room = await startParty(test, { visibility: 'public', source: { videoId: VIDEO_A } });

    expectOk(await closeRoom(test.deps, room.id, userCaller(OWNER)));

    expect(test.discoveryEvents().at(-1)).toEqual({
      type: 'party.closed',
      payload: { id: room.id },
    });
  });

  it('sends closed when a listed room moves onto a video the list would not show', async () => {
    const test = await setUp();
    const room = await startParty(test, { visibility: 'public', source: { videoId: VIDEO_A } });
    const stored = expectOk(await test.repositories.watchPartyRooms.findById(room.id));
    if (stored === null) throw new Error('the room is gone');

    await test.deps.discovery.updated({ ...stored, currentVideoId: VIDEO_UNLISTED });

    expect(test.discoveryEvents().at(-1)).toEqual({
      type: 'party.closed',
      payload: { id: room.id },
    });
  });

  it('never announces the count of a room the list would not show', async () => {
    const test = await setUp();
    const room = await startParty(test, {
      visibility: 'unlisted',
      source: { videoId: VIDEO_UNLISTED },
    });

    expectOk(await joinRoom(test.deps, room.id, userCaller(MEMBER), null));
    await elapse(test.deps.config.discovery.countsBatchMs);

    expect(test.discoveryEvents()).toEqual([]);
  });
});

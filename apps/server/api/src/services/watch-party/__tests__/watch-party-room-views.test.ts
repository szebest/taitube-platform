import { expectOk } from '@vp/testing/result';
import { presentRoom, presentRooms } from '../watch-party-room-views';
import {
  OTHER,
  OWNER,
  seedParty,
  startParty,
  VIDEO_A,
  watchPartyTestDeps,
} from './watch-party-test-deps';

async function setUpViews() {
  const test = watchPartyTestDeps();
  await seedParty(test);
  return test;
}

describe('apps/server/api/services: presentRoom', () => {
  it('names the owner by their channel and shows the video on screen', async () => {
    const test = await setUpViews();
    const created = await startParty(test, { source: { videoId: VIDEO_A } });
    const room = expectOk(await test.repositories.watchPartyRooms.findById(created.id));

    const view = expectOk(await presentRoom(test.deps, room ?? never()));

    expect(view.owner).toEqual({
      memberKey: `user:${OWNER.id}`,
      name: 'Olivia Owner',
      avatarUrl: null,
    });
    expect(view.currentVideo).toEqual({
      id: VIDEO_A,
      title: 'First',
      durationMs: null,
      thumbnailUrl: null,
    });
    expect(view.effectiveCapacity).toBe(test.deps.config.maxMembers);
  });

  it('shows no video where the lobby has none', async () => {
    const test = await setUpViews();
    const created = await startParty(test);
    const room = expectOk(await test.repositories.watchPartyRooms.findById(created.id));

    expect(expectOk(await presentRoom(test.deps, room ?? never())).currentVideo).toBeNull();
  });
});

describe('apps/server/api/services: presentRooms', () => {
  it('presents each room with its own owner, in order', async () => {
    const test = await setUpViews();
    const ids = [(await startParty(test)).id, (await startParty(test, {}, OTHER)).id];
    const found = await Promise.all(
      ids.map((id) => test.repositories.watchPartyRooms.findById(id))
    );

    const views = expectOk(
      await presentRooms(
        test.deps,
        found.map((room) => expectOk(room) ?? never())
      )
    );

    expect(views.map(({ id, owner }) => [id, owner.name])).toEqual([
      [ids[0], 'Olivia Owner'],
      [ids[1], 'Oscar Other'],
    ]);
  });

  it('presents no rooms as none', async () => {
    const test = await setUpViews();

    expect(expectOk(await presentRooms(test.deps, []))).toEqual([]);
  });
});

function never(): never {
  throw new Error('the room was not stored');
}

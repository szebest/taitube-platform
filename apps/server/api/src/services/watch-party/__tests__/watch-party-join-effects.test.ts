import { expectOk } from '@vp/testing/result';
import { joinRoom, leaveRoom } from '../watch-party-join';
import { setUpJoin } from './watch-party-join-fixture';
import { MEMBER, reading, userCaller } from './watch-party-test-deps';

describe('apps/server/api/services: joining as seen by the metrics and the sockets', () => {
  it('counts a join as joined by the kind that made it', async () => {
    const test = await setUpJoin();

    await test.join();

    expect(
      await reading(test.metrics.watchPartyJoinsTotal, { kind: 'user', outcome: 'joined' })
    ).toBe(1);
  });

  it('counts a refused join by its reason', async () => {
    const test = await setUpJoin();
    expectOk(
      await test.repositories.watchPartyRooms.close(test.room.id, 'owner', null, test.deps.now())
    );

    await joinRoom(test.deps, test.room.id, userCaller(MEMBER), null);

    expect(
      await reading(test.metrics.watchPartyJoinsTotal, { kind: 'user', outcome: 'closed' })
    ).toBe(1);
  });

  it('pushes the joined line to the sockets, and the left line with a roster removal on leaving', async () => {
    const test = await setUpJoin();

    await test.join();
    expectOk(await leaveRoom(test.deps, test.room.id, userCaller(MEMBER)));

    expect(test.systemLines().map((line) => line?.event)).toEqual(['joined', 'left']);
    expect(test.frames().at(-1)?.frame).toMatchObject({
      type: 'roster.patch',
      removals: [`user:${MEMBER.id}`],
    });
  });
});

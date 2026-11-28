import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { adminCloseRoom, adminRestoreRoom } from '../watch-party-admin';
import { reportRoom } from '../watch-party-reports';
import {
  MEMBER,
  MODERATOR,
  OTHER,
  OWNER,
  seedParty,
  startParty,
  userCaller,
  VIDEO_A,
  watchPartyTestDeps,
} from './watch-party-test-deps';

async function setUp() {
  const test = watchPartyTestDeps();
  await seedParty(test);
  const room = await startParty(test, { visibility: 'public', source: { videoId: VIDEO_A } });
  const hide = async () => {
    for (const user of [MEMBER, OTHER, MODERATOR]) {
      expectOk(
        await reportRoom(test.deps, room.id, userCaller(user), { reason: 'spam', context: 'room' })
      );
    }
  };
  return { ...test, room, hide };
}

describe('apps/server/api/services: the moderator close and restore', () => {
  it('closes the room for everyone and tells the discovery stream', async () => {
    const { deps, room, discoveryEvents } = await setUp();

    expectOk(await adminCloseRoom(deps, room.id, userCaller(MODERATOR)));

    expect(discoveryEvents().at(-1)).toEqual({ type: 'party.closed', payload: { id: room.id } });
  });

  it('refuses anyone who is not a moderator', async () => {
    const { deps, room } = await setUp();

    expect(expectErr(await adminCloseRoom(deps, room.id, userCaller(OWNER))).code).toBe(
      ErrorCodes.FORBIDDEN
    );
  });

  it('lists a restored room in the discovery stream again', async () => {
    const { deps, room, hide, discoveryEvents } = await setUp();
    await hide();

    expectOk(await adminRestoreRoom(deps, room.id, userCaller(MODERATOR)));

    expect(discoveryEvents().at(-1)).toMatchObject({
      type: 'party.opened',
      payload: { card: { id: room.id } },
    });
  });
});

import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import { reportRoom } from '../watch-party-reports';
import {
  MEMBER,
  MODERATOR,
  OTHER,
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
  const report = (user: typeof MEMBER) =>
    reportRoom(test.deps, room.id, userCaller(user), { reason: 'spam', context: 'room' });
  return { ...test, room, report };
}

describe('apps/server/api/services: reportRoom', () => {
  it('takes the room out of the discovery stream with the third report, and not before', async () => {
    const { report, room, discoveryEvents } = await setUp();

    expectOk(await report(MEMBER));
    expectOk(await report(OTHER));
    expect(discoveryEvents().filter(({ type }) => type === 'party.closed')).toEqual([]);
    expectOk(await report(MODERATOR));

    expect(discoveryEvents().at(-1)).toEqual({ type: 'party.closed', payload: { id: room.id } });
  });

  it('answers a second report from the same account with already reported', async () => {
    const { report } = await setUp();
    expectOk(await report(MEMBER));

    expect(expectErr(await report(MEMBER)).code).toBe(ErrorCodes.WATCH_PARTY_ALREADY_REPORTED);
  });
});

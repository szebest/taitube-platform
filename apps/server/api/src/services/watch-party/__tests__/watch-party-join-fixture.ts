import { expectOk } from '@vp/testing/result';
import { joinRoom } from '../watch-party-join';
import {
  type PartyBodyOverrides,
  seedParty,
  startParty,
  userCaller,
  MEMBER,
  type WatchPartyTestOptions,
  watchPartyTestDeps,
} from './watch-party-test-deps';

export const PASSWORD = 'open sesame';

export async function setUpJoin(
  body: PartyBodyOverrides = {},
  options: WatchPartyTestOptions = {}
) {
  const test = watchPartyTestDeps(options);
  await seedParty(test);
  const room = await startParty(test, body);
  const join = (caller = userCaller(MEMBER), joinBody?: { password?: string; invite?: string }) =>
    joinRoom(test.deps, room.id, caller, joinBody);
  const lines = async () =>
    expectOk(await test.repositories.watchPartyMessages.listAfter(room.id, null, 100));
  const seated = async () =>
    expectOk(await test.repositories.watchPartyMembers.listSeated(room.id)).map(
      ({ memberKey }) => memberKey
    );
  return { ...test, room, join, lines, seated };
}

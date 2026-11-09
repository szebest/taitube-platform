import { ErrorCodes, watchPartyClosed } from '@vp/errors';
import { ok, type Result } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { actingAsMember } from '../watch-party-seated-actions';
import { keyOf, ROOM_ID, seatUser, seedRoom } from './watch-party-moderation-fixture';
import {
  ANONYMOUS,
  MEMBER,
  OTHER,
  OWNER,
  userCaller,
  watchPartyTestDeps,
} from './watch-party-test-deps';

async function setUpRoom() {
  const test = watchPartyTestDeps();
  const at = test.deps.now();
  await seedRoom(test.repositories, OWNER, at);
  await seatUser(test.repositories, MEMBER, at);
  const act = vi.fn(async (_context: unknown, memberKey: string): Promise<Result<string, never>> =>
    ok(memberKey)
  );
  return { ...test, act };
}

describe('actingAsMember', () => {
  it.each([
    { who: 'the owner', caller: userCaller(OWNER), key: keyOf(OWNER) },
    { who: 'a seated member', caller: userCaller(MEMBER), key: keyOf(MEMBER) },
  ])('hands $who their member key', async ({ caller, key }) => {
    const { deps, act } = await setUpRoom();

    const result = await actingAsMember(deps.context, ROOM_ID, caller, act);

    expect(expectOk(result)).toBe(key);
  });

  it.each([
    { who: 'an account without a seat', caller: userCaller(OTHER) },
    { who: 'nobody', caller: ANONYMOUS },
  ])('refuses $who as a stranger to the room without running the act', async ({ caller }) => {
    const { deps, act } = await setUpRoom();

    const result = await actingAsMember(deps.context, ROOM_ID, caller, act);

    expect(expectErr(result).code).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
    expect(act).not.toHaveBeenCalled();
  });

  it('refuses a missing room', async () => {
    const { deps, act } = await setUpRoom();

    const result = await actingAsMember(deps.context, 'no-such-room', userCaller(OWNER), act);

    expect(expectErr(result).code).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
  });

  it.each([
    { scenario: 'with a failure for a closed room', whenClosed: watchPartyClosed, ran: false },
    { scenario: 'without one', whenClosed: undefined, ran: true },
  ])('treats a closed room $scenario', async ({ whenClosed, ran }) => {
    const { deps, repositories, act } = await setUpRoom();
    expectOk(await repositories.watchPartyRooms.close(ROOM_ID, 'owner', null, deps.now()));

    const result = await actingAsMember(deps.context, ROOM_ID, userCaller(OWNER), act, whenClosed);

    expect(act).toHaveBeenCalledTimes(ran ? 1 : 0);
    expect(result.ok).toBe(ran);
    if (!ran) expect(expectErr(result).code).toBe(ErrorCodes.WATCH_PARTY_CLOSED);
  });
});

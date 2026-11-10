import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  ANONYMOUS,
  MEMBER,
  OWNER,
  seedParty,
  startParty,
  userCaller,
  watchPartyTestDeps,
} from './watch-party-test-deps';

async function setUp() {
  const test = watchPartyTestDeps();
  await seedParty(test);
  const room = await startParty(test);
  return { ...test, room, loader: test.deps.context };
}

describe('WatchPartyContextLoader', () => {
  it('refuses a room that does not exist', async () => {
    const { loader } = await setUp();

    const failure = expectErr(
      await loader.load('018f0000-0000-7000-8000-0000000000ff', userCaller(OWNER))
    );

    expect(failure.code).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
  });

  it('gives the owner the seat, the ownership and every permission', async () => {
    const { loader, room } = await setUp();

    const context = expectOk(await loader.load(room.id, userCaller(OWNER)));

    expect(context).toMatchObject({ isOwner: true, kind: 'user', seat: expect.anything() });
    expect(context.effective.permissions).toContain('roles.manage');
  });

  it.each([
    { who: 'a signed-in account with no seat', caller: userCaller(MEMBER), kind: 'user' },
    { who: 'a caller with no identity', caller: ANONYMOUS, kind: null },
  ])('gives $who no seat and no permission', async ({ caller, kind }) => {
    const { loader, room } = await setUp();

    const context = expectOk(await loader.load(room.id, caller));

    expect(context).toMatchObject({ isOwner: false, seat: null, kind });
    expect(context.effective.permissions).toEqual([]);
  });
});

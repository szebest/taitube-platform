import { MS_PER_MINUTE } from '@vp/domain/time';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { leaveRoom } from '../watch-party-join';
import { userOf } from './watch-party-access-fixture';
import { PASSWORD, setUpJoin } from './watch-party-join-fixture';
import { MEMBER, userCaller } from './watch-party-test-deps';

describe('apps/server/api/services: joinRoom passwords', () => {
  const wrong = { password: 'not it at all' };

  it('locks the sixth attempt of one member, even with the right password, and says when to retry', async () => {
    const { join } = await setUpJoin({ password: PASSWORD });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(expectErr(await join(userCaller(MEMBER), wrong)).code).toBe(
        ErrorCodes.WATCH_PARTY_PASSWORD_INVALID
      );
    }

    expect(expectErr(await join(userCaller(MEMBER), { password: PASSWORD }))).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED,
      retryAfterSeconds: 15 * 60,
    });
  });

  it('locks an address across member keys, and only that address', async () => {
    const { join } = await setUpJoin({ password: PASSWORD });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await join(userCaller(userOf(attempt), '198.51.100.9'), wrong);
    }

    const sameAddress = await join(userCaller(MEMBER, '198.51.100.9'), { password: PASSWORD });
    const elsewhere = await join(userCaller(MEMBER, '198.51.100.10'), { password: PASSWORD });

    expect(expectErr(sameAddress).code).toBe(ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED);
    expectOk(elsewhere);
  });

  it('lets the lock go when the window ends', async () => {
    const { join, clock } = await setUpJoin({ password: PASSWORD });
    for (let attempt = 0; attempt < 5; attempt += 1) await join(userCaller(MEMBER), wrong);

    clock.advance(15 * MS_PER_MINUTE);

    expectOk(await join(userCaller(MEMBER), { password: PASSWORD }));
  });

  it('clears the member’s count on the right password', async () => {
    const { join, room, deps } = await setUpJoin({ password: PASSWORD });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await join(userCaller(MEMBER, `198.51.100.${attempt}`), wrong);
    }
    expectOk(await join(userCaller(MEMBER, '198.51.100.50'), { password: PASSWORD }));
    expectOk(await leaveRoom(deps, room.id, userCaller(MEMBER)));

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await join(userCaller(MEMBER, `198.51.100.${60 + attempt}`), wrong);
      expect(expectErr(result).code).toBe(ErrorCodes.WATCH_PARTY_PASSWORD_INVALID);
    }
  });

  it('seats someone who sends the right password and records how', async () => {
    const { join } = await setUpJoin({ password: PASSWORD });

    expect(
      expectOk(await join(userCaller(MEMBER), { password: PASSWORD })).membership.joinedVia
    ).toBe('password');
  });
});

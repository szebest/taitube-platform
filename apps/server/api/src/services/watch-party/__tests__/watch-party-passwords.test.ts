import { MS_PER_MINUTE } from '@vp/domain/time';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { checkPassword, type PasswordAttempt } from '../watch-party-passwords';
import { watchPartyTestDeps } from './watch-party-test-deps';

const ROOM = 'room-1';
const SECRET = 'open sesame';

async function setUpPasswords() {
  const test = watchPartyTestDeps();
  const passwordHash = expectOk(await test.deps.hasher.hash(SECRET));
  const check = (overrides: Partial<PasswordAttempt> = {}) =>
    checkPassword(test.deps, {
      roomId: ROOM,
      memberKey: 'user:a',
      ip: '198.51.100.1',
      passwordHash,
      password: SECRET,
      ...overrides,
    });
  return { ...test, check };
}

describe('apps/server/api/services: checkPassword', () => {
  it.each([
    { scenario: 'the right password', password: SECRET, expected: 'valid' },
    { scenario: 'a wrong password', password: 'not it at all', expected: 'invalid' },
  ])('answers $expected for $scenario', async ({ password, expected }) => {
    const { check } = await setUpPasswords();

    expect(expectOk(await check({ password }))).toBe(expected);
  });

  it('locks the sixth attempt of a member key, even with the right password', async () => {
    const { check } = await setUpPasswords();
    for (let wrong = 0; wrong < 5; wrong += 1)
      await check({ password: 'wrong', ip: `10.0.0.${wrong}` });

    expect(expectErr(await check({ ip: '10.0.0.99' }))).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED,
      retryAfterSeconds: 900,
    });
  });

  it('locks an address across member keys', async () => {
    const { check } = await setUpPasswords();
    for (let wrong = 0; wrong < 5; wrong += 1)
      await check({ password: 'wrong', memberKey: `user:${wrong}` });

    expect(expectErr(await check({ memberKey: 'user:fresh' })).code).toBe(
      ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED
    );
    expectOk(await check({ memberKey: 'user:fresh', ip: '198.51.100.2' }));
  });

  it('keeps each room’s count to itself', async () => {
    const { check } = await setUpPasswords();
    for (let wrong = 0; wrong < 5; wrong += 1) await check({ password: 'wrong' });

    expectOk(await check({ roomId: 'room-2' }));
  });

  it('clears the member key on the right password but not the address', async () => {
    const { check } = await setUpPasswords();
    for (let wrong = 0; wrong < 4; wrong += 1)
      await check({ password: 'wrong', ip: `10.0.0.${wrong}` });
    expectOk(await check({ ip: '10.0.0.50' }));

    for (let wrong = 0; wrong < 5; wrong += 1) {
      expect(expectOk(await check({ password: 'wrong', ip: `10.0.1.${wrong}` }))).toBe('invalid');
    }
  });

  it('lets only the allowed attempts reach the hash when they arrive in parallel', async () => {
    const { check, deps } = await setUpPasswords();
    const verify = vi.spyOn(deps.hasher, 'verify');

    const results = await Promise.all(
      Array.from({ length: 20 }, () => check({ password: 'wrong' }))
    );

    expect(verify).toHaveBeenCalledTimes(5);
    expect(results.filter((result) => result.ok && result.value === 'invalid')).toHaveLength(5);
    expect(results.filter((result) => !result.ok)).toHaveLength(15);
  });

  it('lets the lock go when the window ends', async () => {
    const { check, clock } = await setUpPasswords();
    for (let wrong = 0; wrong < 5; wrong += 1) await check({ password: 'wrong' });

    clock.advance(15 * MS_PER_MINUTE);

    expect(expectOk(await check())).toBe('valid');
  });
});

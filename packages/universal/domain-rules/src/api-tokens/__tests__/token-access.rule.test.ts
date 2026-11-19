import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { decideApiTokenAccess } from '../token-access.rule';

const SESSION: UserContext = { id: 'usr-1', role: 'USER' };
const TOKEN: UserContext = {
  ...SESSION,
  token: { id: 'tok-1', channelId: 'chan-1', scopes: ['videos:write'] },
};

const ACCESSES = ['create', 'read', 'delete'] as const;

describe('@vp/domain-rules: decideApiTokenAccess', () => {
  it.each(ACCESSES)('lets a signed-in session %s its tokens', (access) => {
    expect(expectOk(decideApiTokenAccess({ user: SESSION, access }))).toBe(SESSION);
  });

  it.each([
    ...ACCESSES.map((access) => ({
      access,
      caller: 'a token',
      user: TOKEN,
      code: ErrorCodes.FORBIDDEN,
    })),
    ...ACCESSES.map((access) => ({
      access,
      caller: 'nobody',
      user: null,
      code: ErrorCodes.UNAUTHORIZED,
    })),
    ...ACCESSES.map((access) => ({
      access,
      caller: 'a guest',
      user: { id: 'g-1', role: 'GUEST' } as UserContext,
      code: ErrorCodes.FORBIDDEN,
    })),
  ])('refuses $access to $caller as $code', ({ access, user, code }) => {
    expect(expectErr(decideApiTokenAccess({ user, access }))).toMatchObject({ code });
  });
});

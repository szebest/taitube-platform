import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { ADMIN, STRANGER } from '../../__tests__/entities';
import { decideAdminAccess } from '../admin-access.rule';

describe('@vp/domain-rules: decideAdminAccess', () => {
  it('returns the caller when they hold the role', () => {
    expect(isOk(decideAdminAccess(ADMIN))).toBe(true);
  });

  it.each([
    { name: 'an anonymous caller', user: null, code: ErrorCodes.UNAUTHORIZED },
    { name: 'a signed-in caller without the role', user: STRANGER, code: ErrorCodes.FORBIDDEN },
  ])('refuses $name with $code', ({ user, code }) => {
    const result = decideAdminAccess(user);

    expect(isErr(result) && result.error.code).toBe(code);
  });
});

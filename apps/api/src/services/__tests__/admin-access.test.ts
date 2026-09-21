import { CaslAuthorizationAdapter } from '@vp/adapters';
import { ErrorCodes } from '@vp/errors';
import { assertAdminAccess } from '../admin-access';

const auth = new CaslAuthorizationAdapter();

describe('apps/api/services: admin access', () => {
  it.each([['admin'], ['ADMIN']])('admits a caller whose role reads as %s', (role) => {
    expect(() => assertAdminAccess(auth, { id: 'ops-1', role })).not.toThrow();
  });

  it('answers an anonymous caller with UNAUTHORIZED, not FORBIDDEN', () => {
    expect(() => assertAdminAccess(auth, null)).toThrow(
      expect.objectContaining({ code: ErrorCodes.UNAUTHORIZED })
    );
  });

  it.each([['user'], ['creator'], ['moderator'], ['not-a-role']])(
    'refuses a %s caller with FORBIDDEN',
    (role) => {
      expect(() => assertAdminAccess(auth, { id: 'user-1', role })).toThrow(
        expect.objectContaining({ code: ErrorCodes.FORBIDDEN })
      );
    }
  );
});

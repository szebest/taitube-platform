import { CaslAuthorizationAdapter } from '@vp/adapters';
import { ErrorCodes } from '@vp/errors';
import type { Role } from '@vp/permissions';
import { assertAdminAccess } from '../admin-access';

const auth = new CaslAuthorizationAdapter();

describe('apps/api/services: admin access', () => {
  it('admits an admin caller', () => {
    expect(() => assertAdminAccess(auth, { id: 'ops-1', role: 'ADMIN' })).not.toThrow();
  });

  it('answers an anonymous caller with UNAUTHORIZED, not FORBIDDEN', () => {
    expect(() => assertAdminAccess(auth, null)).toThrow(
      expect.objectContaining({ code: ErrorCodes.UNAUTHORIZED })
    );
  });

  it.each<{ role: Role }>([
    { role: 'GUEST' },
    { role: 'USER' },
    { role: 'CREATOR' },
    { role: 'MODERATOR' },
  ])('refuses a $role caller with FORBIDDEN', ({ role }) => {
    expect(() => assertAdminAccess(auth, { id: 'user-1', role })).toThrow(
      expect.objectContaining({ code: ErrorCodes.FORBIDDEN })
    );
  });
});

import type { UserContext } from '../../types/index.js';
import { canAccessAdmin } from '../admin.js';

describe('permissions/helpers: canAccessAdmin', () => {
  it('grants an admin', () => {
    expect(canAccessAdmin({ user: { id: 'adm-1', role: 'ADMIN' } })).toBe(true);
  });

  it.each<{ role: UserContext['role'] }>([
    { role: 'GUEST' },
    { role: 'USER' },
    { role: 'CREATOR' },
    { role: 'MODERATOR' },
  ])('denies a $role', ({ role }) => {
    expect(canAccessAdmin({ user: { id: 'usr-1', role } })).toBe(false);
  });

  it('denies an unauthenticated caller', () => {
    expect(canAccessAdmin({ user: null })).toBe(false);
  });
});

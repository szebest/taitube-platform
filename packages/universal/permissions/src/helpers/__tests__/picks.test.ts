import type { Role } from '../../types/index';
import { canManagePick } from '../picks';

describe('helpers/picks: canManagePick', () => {
  it('grants an admin', () => {
    expect(canManagePick({ user: { id: 'adm-1', role: 'ADMIN' } })).toBe(true);
  });

  it.each<{ role: Role }>([
    { role: 'GUEST' },
    { role: 'USER' },
    { role: 'CREATOR' },
    { role: 'MODERATOR' },
  ])('denies a $role', ({ role }) => {
    expect(canManagePick({ user: { id: 'usr-1', role } })).toBe(false);
  });

  it('denies an unauthenticated caller', () => {
    expect(canManagePick({ user: null })).toBe(false);
  });
});

import type { Role } from '../../types';
import { canManageCategory } from '../categories';

describe('helpers/categories: canManageCategory', () => {
  it('grants an admin', () => {
    expect(canManageCategory({ user: { id: 'adm-1', role: 'ADMIN' } })).toBe(true);
  });

  it.each<{ role: Role }>([
    { role: 'GUEST' },
    { role: 'USER' },
    { role: 'CREATOR' },
    { role: 'MODERATOR' },
  ])('denies a $role', ({ role }) => {
    expect(canManageCategory({ user: { id: 'usr-1', role } })).toBe(false);
  });

  it('denies an unauthenticated caller', () => {
    expect(canManageCategory({ user: null })).toBe(false);
  });
});

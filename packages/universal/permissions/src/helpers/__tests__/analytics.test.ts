import type { Role } from '../../types/index.js';
import { canViewAllAnalytics } from '../analytics.js';

describe('helpers/analytics: canViewAllAnalytics', () => {
  it('grants an admin', () => {
    expect(canViewAllAnalytics({ user: { id: 'adm-1', role: 'ADMIN' } })).toBe(true);
  });

  it.each<{ role: Role }>([
    { role: 'GUEST' },
    { role: 'USER' },
    { role: 'CREATOR' },
    { role: 'MODERATOR' },
  ])('denies a $role', ({ role }) => {
    expect(canViewAllAnalytics({ user: { id: 'usr-1', role } })).toBe(false);
  });

  it('denies an unauthenticated caller', () => {
    expect(canViewAllAnalytics({ user: null })).toBe(false);
  });
});

import type { Role } from '../../types/index';
import { canCreateWebhook } from '../webhooks';

describe('helpers/webhooks: canCreateWebhook', () => {
  it.each<{ role: Role; expected: boolean }>([
    { role: 'GUEST', expected: false },
    { role: 'USER', expected: true },
    { role: 'CREATOR', expected: true },
    { role: 'MODERATOR', expected: true },
    { role: 'ADMIN', expected: true },
  ])('answers $expected for a $role', ({ role, expected }) => {
    expect(canCreateWebhook({ user: { id: 'usr-1', role } })).toBe(expected);
  });

  it('denies an unauthenticated caller', () => {
    expect(canCreateWebhook({ user: null })).toBe(false);
  });
});

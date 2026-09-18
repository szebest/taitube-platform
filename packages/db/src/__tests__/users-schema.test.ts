import { describe, expect, it } from 'vitest';
import { UserRoles, userRoleEnum, users } from '../schema';

describe('Users Schema (Ticket 39)', () => {
  it('defines userRoleEnum with correct enum values', () => {
    expect(UserRoles).toEqual(['USER', 'CREATOR', 'MODERATOR', 'ADMIN']);
    expect(userRoleEnum.enumValues).toEqual(['USER', 'CREATOR', 'MODERATOR', 'ADMIN']);
  });

  it('defines role column on users table with default USER', () => {
    expect(users.role).toBeDefined();
    expect(users.role.default).toBe('USER');
    expect(users.role.notNull).toBe(true);
  });
});

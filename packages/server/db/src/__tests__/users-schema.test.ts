import { USER_ROLES } from '@vp/domain';
import { describe, expect, it } from 'vitest';
import { userRoleEnum, users } from '../schema';

describe('Users Schema (Ticket 39)', () => {
  it('builds userRoleEnum from the domain vocabulary', () => {
    expect(userRoleEnum.enumValues).toEqual([...USER_ROLES]);
  });

  it('defines role column on users table with default USER', () => {
    expect(users.role).toBeDefined();
    expect(users.role.default).toBe('USER');
    expect(users.role.notNull).toBe(true);
  });
});

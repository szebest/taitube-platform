import { USER_ROLES } from '@vp/domain';
import { userRoleEnum, users } from '../schema';

describe('users schema', () => {
  it('builds userRoleEnum from the domain vocabulary', () => {
    expect(userRoleEnum.enumValues).toEqual([...USER_ROLES]);
  });

  it('defines role column on users table with default USER', () => {
    expect(users.role).toBeDefined();
    expect(users.role.default).toBe('USER');
    expect(users.role.notNull).toBe(true);
  });
});

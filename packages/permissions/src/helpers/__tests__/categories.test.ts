import { describe, expect, it } from 'vitest';
import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  standardUser,
} from '../../__mocks__/fixtures';
import { canManageCategory } from '../categories';

describe('helpers/categories: canManageCategory', () => {
  it('returns false when user is null or anonymous', () => {
    expect(canManageCategory({ user: null })).toBe(false);
  });

  it('forbids guest, user, creator, and moderator', () => {
    expect(canManageCategory({ user: guestUser })).toBe(false);
    expect(canManageCategory({ user: standardUser })).toBe(false);
    expect(canManageCategory({ user: creatorUser })).toBe(false);
    expect(canManageCategory({ user: moderatorUser })).toBe(false);
  });

  it('allows admin', () => {
    expect(canManageCategory({ user: adminUser })).toBe(true);
  });
});

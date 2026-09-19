import { describe, expect, it } from 'vitest';
import {
  adminUser,
  creatorUser,
  guestUser,
  moderatorUser,
  standardUser,
} from '../../__mocks__/fixtures';
import { canViewAllAnalytics } from '../analytics';

describe('helpers/analytics: canViewAllAnalytics', () => {
  it('returns false when user is null or anonymous', () => {
    expect(canViewAllAnalytics({ user: null })).toBe(false);
  });

  it('returns false for GUEST, USER, and CREATOR', () => {
    expect(canViewAllAnalytics({ user: guestUser })).toBe(false);
    expect(canViewAllAnalytics({ user: standardUser })).toBe(false);
    expect(canViewAllAnalytics({ user: creatorUser })).toBe(false);
  });

  it('returns false for MODERATOR (unless admin/moderator analytics rule configured)', () => {
    expect(canViewAllAnalytics({ user: moderatorUser })).toBe(false);
  });

  it('returns true for ADMIN', () => {
    expect(canViewAllAnalytics({ user: adminUser })).toBe(true);
  });
});

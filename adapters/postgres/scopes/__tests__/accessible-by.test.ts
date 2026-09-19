import { type UserContext, getUserPermissions } from '@vp/permissions';
import { describe, expect, it } from 'vitest';
import { accessibleBy, accessibleVideos, videoOwnerScope, videoReadScope } from '../accessible-by';

describe('adapters/postgres/scoping: accessible-by adapter', () => {
  const guestUser: UserContext | null = null;
  const standardUser: UserContext = { id: 'usr-123', role: 'USER' };
  const moderatorUser: UserContext = { id: 'mod-456', role: 'MODERATOR' };
  const adminUser: UserContext = { id: 'adm-789', role: 'ADMIN' };

  describe('accessibleVideos', () => {
    it('returns public visibility filter for guest / unauthenticated', () => {
      const scope = accessibleVideos(guestUser);
      expect(scope).toBeDefined();
    });

    it('returns undefined (unconditional pass) for admin user', () => {
      expect(accessibleVideos(adminUser)).toBeUndefined();
    });

    it('returns undefined (unconditional pass) for moderator user', () => {
      expect(accessibleVideos(moderatorUser)).toBeUndefined();
    });

    it('returns undefined when passed AppAbility with manage all', () => {
      const adminAbility = getUserPermissions(adminUser);
      expect(accessibleVideos(adminAbility)).toBeUndefined();
    });

    it('returns public filter when passed AppAbility for guest', () => {
      const guestAbility = getUserPermissions(guestUser);
      expect(accessibleVideos(guestAbility)).toBeDefined();
    });

    it('returns or() filter for standard authenticated user', () => {
      const scope = accessibleVideos(standardUser);
      expect(scope).toBeDefined();
    });
  });

  describe('accessibleBy entrypoint', () => {
    it('delegates to accessibleVideos for Video subject', () => {
      expect(accessibleBy(adminUser, 'Video', 'read')).toBeUndefined();
      expect(accessibleBy(guestUser, 'Video', 'read')).toBeDefined();
    });
  });

  describe('videoReadScope', () => {
    it('delegates to accessibleVideos correctly', () => {
      expect(videoReadScope(guestUser)).toBeDefined();
      expect(videoReadScope(adminUser)).toBeUndefined();
    });
  });

  describe('videoOwnerScope', () => {
    it('generates owner filter from UserContext or string ID', () => {
      expect(videoOwnerScope(standardUser)).toBeDefined();
      expect(videoOwnerScope('usr-123')).toBeDefined();
    });
  });
});

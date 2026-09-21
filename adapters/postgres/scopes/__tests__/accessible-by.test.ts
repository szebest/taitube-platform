import { videos } from '@vp/db';
import { type UserContext, getUserPermissions } from '@vp/permissions';
import {
  accessibleBy,
  ownerScope,
  publicVisibilityScope,
  videoReadScope,
} from '../accessible-by';
import { sqlParams, sqlText } from './sql-text';

describe('adapters/postgres/scoping: accessible-by adapter', () => {
  const guest: UserContext | null = null;
  const standardUser: UserContext = { id: 'usr-123', role: 'USER' };
  const moderator: UserContext = { id: 'mod-456', role: 'MODERATOR' };
  const admin: UserContext = { id: 'adm-789', role: 'ADMIN' };

  const GUEST_READ_SQL = '("videos"."visibility" = $1 or "videos"."visibility" = $2)';

  describe('videoReadScope', () => {
    it('restricts a guest to publicly readable videos', () => {
      const scope = videoReadScope(guest);
      expect(sqlText(scope)).toBe(GUEST_READ_SQL);
      expect(sqlParams(scope)).toEqual(['unlisted', 'public']);
    });

    it('widens the scope to videos owned by the authenticated user', () => {
      const scope = videoReadScope(standardUser);
      expect(sqlText(scope)).toBe(
        '("videos"."owner_id" = $1 or "videos"."visibility" = $2 or "videos"."visibility" = $3)'
      );
      expect(sqlParams(scope)).toEqual(['usr-123', 'unlisted', 'public']);
    });

    it.each([
      { name: 'moderator', user: moderator },
      { name: 'admin', user: admin },
    ])('imposes no restriction for a $name', ({ user }) => {
      expect(videoReadScope(user)).toBeUndefined();
    });

    it('accepts a prebuilt ability and yields the same scope as its user', () => {
      expect(sqlText(videoReadScope(getUserPermissions(guest)))).toBe(GUEST_READ_SQL);
      expect(videoReadScope(getUserPermissions(admin))).toBeUndefined();
    });
  });

  describe('accessibleBy', () => {
    it('compiles a non-default action against the given table', () => {
      const scope = accessibleBy(standardUser, 'Video', videos, 'update');
      expect(sqlText(scope)).toBe('"videos"."owner_id" = $1');
      expect(sqlParams(scope)).toEqual(['usr-123']);
    });

    it('matches no rows when the action is forbidden', () => {
      expect(sqlText(accessibleBy(guest, 'Video', videos, 'delete'))).toBe('false');
    });
  });

  describe('ownerScope', () => {
    it.each([
      { kind: 'UserContext', owner: standardUser as UserContext | string },
      { kind: 'owner id string', owner: 'usr-123' as UserContext | string },
    ])('filters on the owner column given a $kind', ({ owner }) => {
      const scope = ownerScope(videos, owner);
      expect(sqlText(scope)).toBe('"videos"."owner_id" = $1');
      expect(sqlParams(scope)).toEqual(['usr-123']);
    });
  });

  describe('publicVisibilityScope', () => {
    it('keeps unlisted videos out of listings', () => {
      const scope = publicVisibilityScope(videos);
      expect(sqlText(scope)).toBe('"videos"."visibility" = $1');
      expect(sqlParams(scope)).toEqual(['public']);
    });
  });
});

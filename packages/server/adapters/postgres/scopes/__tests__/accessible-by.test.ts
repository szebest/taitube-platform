import { videos } from '@vp/db';
import type { UserContext } from '@vp/permissions';
import {
  ownerScope,
  playlistReadScope,
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
  });

  describe('playlistReadScope', () => {
    it('restricts a guest to public and unlisted playlists', () => {
      const scope = playlistReadScope(guest);
      expect(sqlText(scope)).toBe(
        '("playlists"."visibility" = $1 or "playlists"."visibility" = $2)'
      );
      expect(sqlParams(scope)).toEqual(['unlisted', 'public']);
    });

    it('widens the scope to the playlists the user owns', () => {
      const scope = playlistReadScope(standardUser);
      expect(sqlText(scope)).toBe(
        '("playlists"."owner_id" = $1 or "playlists"."visibility" = $2 or "playlists"."visibility" = $3)'
      );
      expect(sqlParams(scope)).toEqual(['usr-123', 'unlisted', 'public']);
    });

    it('imposes no restriction for an admin', () => {
      expect(playlistReadScope(admin)).toBeUndefined();
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

import type { UserContext } from '@vp/permissions';
import { canUpdateVideo } from '@vp/permissions';
import {
  PermissiveAuthorizationAdapter,
  StrictAuthorizationAdapter,
} from '../in-memory-authorization-adapter';

describe('in-memory-authorization-adapter', () => {
  const user: UserContext = { id: 'usr-1', role: 'USER' };
  const foreignVideo = {
    id: 'vid-2',
    ownerId: 'usr-2',
    visibility: 'public' as const,
    status: 'READY' as const,
  };
  const ownedVideo = {
    id: 'vid-1',
    ownerId: 'usr-1',
    visibility: 'public' as const,
    status: 'READY' as const,
  };

  describe('PermissiveAuthorizationAdapter', () => {
    const adapter = new PermissiveAuthorizationAdapter();

    it('returns an ability via getAbility()', () => {
      expect(adapter.getAbility()).toBeDefined();
    });

    it('always permits actions with can()', () => {
      expect(adapter.can('delete', 'Video')).toBe(true);
      expect(adapter.can(canUpdateVideo, { user, video: foreignVideo })).toBe(true);
    });

    it('assertCan does not throw', () => {
      expect(() => {
        adapter.assertCan(
          canUpdateVideo,
          { user, video: foreignVideo },
          { action: 'update', subject: 'Video' }
        );
      }).not.toThrow();

      expect(() => {
        adapter.assertCan('delete', 'Video');
      }).not.toThrow();
    });

    it('forUser returns the adapter instance', () => {
      expect(adapter.forUser(user)).toBe(adapter);
    });
  });

  describe('StrictAuthorizationAdapter', () => {
    const adapter = new StrictAuthorizationAdapter(user);

    it('returns an ability via getAbility()', () => {
      expect(adapter.getAbility()).toBeDefined();
    });

    it('always denies actions with can()', () => {
      expect(adapter.can('delete', 'Video')).toBe(false);
      expect(adapter.can(canUpdateVideo, { user, video: ownedVideo })).toBe(false);
    });

    it('always throws on assertCan', () => {
      expect(() => {
        adapter.assertCan(
          canUpdateVideo,
          { user, video: ownedVideo },
          { action: 'update', subject: 'Video' }
        );
      }).toThrowError(/Forbidden/);

      expect(() => {
        adapter.assertCan('delete', 'Video');
      }).toThrowError(/Forbidden/);
    });

    it('throws UNAUTHORIZED when user is null', () => {
      const guestAdapter = new StrictAuthorizationAdapter(null);
      expect(() => {
        guestAdapter.assertCan('read', 'Video');
      }).toThrowError(/Authentication required/);
    });

    it('forUser returns a new StrictAuthorizationAdapter with the user set', () => {
      const bound = adapter.forUser({ id: 'usr-2', role: 'ADMIN' });
      expect(bound).toBeInstanceOf(StrictAuthorizationAdapter);
      expect(bound.can('read', 'Video')).toBe(false);
    });
  });
});

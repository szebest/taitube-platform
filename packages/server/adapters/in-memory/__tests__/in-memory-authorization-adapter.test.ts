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

    it('forUser returns a new StrictAuthorizationAdapter with the user set', () => {
      const bound = adapter.forUser({ id: 'usr-2', role: 'ADMIN' });
      expect(bound).toBeInstanceOf(StrictAuthorizationAdapter);
      expect(bound.can('read', 'Video')).toBe(false);
    });
  });
});

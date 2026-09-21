import type { UserContext } from '@vp/permissions';
import { canUpdateVideo } from '@vp/permissions';
import { describe, expect, it } from 'vitest';
import { CaslAuthorizationAdapter } from '../casl-authorization-adapter';

describe('CaslAuthorizationAdapter', () => {
  const user: UserContext = { id: 'usr-1', role: 'USER' };
  const admin: UserContext = { id: 'admin-1', role: 'ADMIN' };
  const ownedVideo = {
    id: 'vid-1',
    ownerId: 'usr-1',
    visibility: 'public' as const,
    status: 'READY' as const,
  };
  const foreignVideo = {
    id: 'vid-2',
    ownerId: 'usr-2',
    visibility: 'public' as const,
    status: 'READY' as const,
  };

  it('provides getAbility() returning AppAbility', () => {
    const adapter = new CaslAuthorizationAdapter(user);
    expect(adapter.getAbility()).toBeDefined();
    expect(adapter.getAbility().can('read', 'Video')).toBe(true);
  });

  it('can() evaluates AppAction + AppSubjects', () => {
    const userAdapter = new CaslAuthorizationAdapter(user);
    expect(userAdapter.can('create', 'Video')).toBe(true);

    const guestAdapter = new CaslAuthorizationAdapter(null);
    expect(guestAdapter.can('create', 'Video')).toBe(false);
  });

  it('can() evaluates permission helper directly', () => {
    const adapter = new CaslAuthorizationAdapter();
    expect(adapter.can(canUpdateVideo, { user, video: ownedVideo })).toBe(true);
    expect(adapter.can(canUpdateVideo, { user, video: foreignVideo })).toBe(false);
    expect(adapter.can(canUpdateVideo, { user: admin, video: foreignVideo })).toBe(true);
  });

  it('assertCan() does not throw when allowed', () => {
    const adapter = new CaslAuthorizationAdapter();
    expect(() => {
      adapter.assertCan(
        canUpdateVideo,
        { user, video: ownedVideo },
        { action: 'update', subject: 'Video' }
      );
    }).not.toThrow();
  });

  it('assertCan() throws 403 FORBIDDEN when not allowed', () => {
    const adapter = new CaslAuthorizationAdapter();
    expect(() => {
      adapter.assertCan(
        canUpdateVideo,
        { user, video: foreignVideo },
        { action: 'update', subject: 'Video' }
      );
    }).toThrowError(/Forbidden/);
  });

  it('assertCan(action, subject) succeeds for permitted action and throws 401/403 when denied', () => {
    const userAdapter = new CaslAuthorizationAdapter(user);
    expect(() => userAdapter.assertCan('create', 'Video')).not.toThrow();

    const guestAdapter = new CaslAuthorizationAdapter(null);
    expect(() => guestAdapter.assertCan('create', 'Video')).toThrowError(/Authentication required/);

    const regularUserAdapter = new CaslAuthorizationAdapter({ id: 'u1', role: 'USER' });
    expect(() => regularUserAdapter.assertCan('manage', 'all')).toThrowError(/Forbidden/);
  });

  it('forUser() returns adapter bound to specific user', () => {
    const adapter = new CaslAuthorizationAdapter();
    const userAuth = adapter.forUser(user);
    expect(userAuth.can('create', 'Video')).toBe(true);
    expect(userAuth.can(canUpdateVideo, { user, video: ownedVideo })).toBe(true);
    expect(userAuth.can(canUpdateVideo, { user, video: foreignVideo })).toBe(false);
  });
});

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

  it.each([
    { scenario: 'a signed-in user', actor: user, action: 'create' as const, expected: true },
    { scenario: 'an anonymous caller', actor: null, action: 'create' as const, expected: false },
    { scenario: 'a user reaching for admin', actor: user, action: 'manage' as const, expected: false },
  ])('can() answers $expected for $scenario', ({ actor, action, expected }) => {
    const adapter = new CaslAuthorizationAdapter(actor);

    expect(adapter.can(action, action === 'manage' ? 'all' : 'Video')).toBe(expected);
  });

  it('can() evaluates permission helper directly', () => {
    const adapter = new CaslAuthorizationAdapter();
    expect(adapter.can(canUpdateVideo, { user, video: ownedVideo })).toBe(true);
    expect(adapter.can(canUpdateVideo, { user, video: foreignVideo })).toBe(false);
    expect(adapter.can(canUpdateVideo, { user: admin, video: foreignVideo })).toBe(true);
  });

  it('forUser() returns adapter bound to specific user', () => {
    const adapter = new CaslAuthorizationAdapter();
    const userAuth = adapter.forUser(user);
    expect(userAuth.can('create', 'Video')).toBe(true);
    expect(userAuth.can(canUpdateVideo, { user, video: ownedVideo })).toBe(true);
    expect(userAuth.can(canUpdateVideo, { user, video: foreignVideo })).toBe(false);
  });
});

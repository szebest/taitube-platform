import { adminUser, creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { canManagePost, canReactPost, canReadPostStats } from '../posts';

const post = { ownerId: creatorUser.id, channelId: 'chan-creator-1' };

const analyst: UserContext = {
  id: 'member-analytics',
  role: 'USER',
  memberships: { 'chan-creator-1': { role: 'analytics', ownerId: creatorUser.id } },
};

describe('helpers/posts', () => {
  it.each<{ scenario: string; user: UserContext | null; manages: boolean; reads: boolean }>([
    { scenario: 'an unauthenticated caller', user: guestUser, manages: false, reads: false },
    { scenario: 'the owning creator', user: creatorUser, manages: true, reads: true },
    { scenario: 'another user', user: standardUser, manages: false, reads: false },
    { scenario: 'the analytics role', user: analyst, manages: false, reads: true },
    { scenario: 'an admin', user: adminUser, manages: true, reads: true },
  ])('$scenario manages a post: $manages, reads its stats: $reads', ({ user, manages, reads }) => {
    expect(canManagePost({ user, action: 'update', post })).toBe(manages);
    expect(canReadPostStats({ user, post })).toBe(reads);
  });

  it.each<{ scenario: string; user: UserContext | null; reacts: boolean }>([
    { scenario: 'an unauthenticated caller', user: guestUser, reacts: false },
    { scenario: 'a guest identity', user: { id: 'guest-1', role: 'GUEST' }, reacts: false },
    { scenario: 'a signed-in user', user: standardUser, reacts: true },
    { scenario: 'the owning creator', user: creatorUser, reacts: true },
  ])('$scenario likes a post: $reacts', ({ user, reacts }) => {
    expect(canReactPost({ user })).toBe(reacts);
  });
});

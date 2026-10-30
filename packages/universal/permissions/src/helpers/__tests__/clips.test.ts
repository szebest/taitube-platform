import { adminUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import { canCreateClip, canDeleteClip } from '../clips';

describe('helpers/clips: who may do what to a clip', () => {
  it.each([
    { who: 'a guest', user: guestUser, create: false },
    { who: 'a viewer', user: standardUser, create: true },
    { who: 'an admin', user: adminUser, create: true },
  ])('lets $who clip a public video: $create', ({ user, create }) => {
    expect(canCreateClip({ user, clip: { visibility: 'public' } })).toBe(create);
  });

  it.each([
    { who: 'the creator', user: standardUser, allowed: true },
    { who: 'a guest', user: guestUser, allowed: false },
    { who: 'an admin', user: adminUser, allowed: true },
  ])('lets $who delete a viewer clip: $allowed', ({ user, allowed }) => {
    expect(canDeleteClip({ user, clip: { userId: standardUser.id } })).toBe(allowed);
  });
});

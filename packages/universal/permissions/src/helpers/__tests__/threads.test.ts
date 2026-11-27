import { adminUser, creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import { canDeleteThread, canPinThread } from '../threads';

const thread = { ownerId: creatorUser.id, channelId: 'chan-creator-1', authorId: 'fan-1' };

const editor: UserContext = {
  id: 'member-editor',
  role: 'USER',
  memberships: { 'chan-creator-1': { role: 'editor', ownerId: creatorUser.id } },
};

const moderator: UserContext = {
  id: 'member-moderator',
  role: 'USER',
  memberships: { 'chan-creator-1': { role: 'moderator', ownerId: creatorUser.id } },
};

describe('helpers/threads', () => {
  it.each<{ scenario: string; user: UserContext | null; pins: boolean }>([
    { scenario: 'an unauthenticated caller', user: guestUser, pins: false },
    { scenario: 'another user', user: standardUser, pins: false },
    { scenario: 'a moderator', user: moderator, pins: false },
    { scenario: 'an editor', user: editor, pins: true },
    { scenario: 'the owning creator', user: creatorUser, pins: true },
    { scenario: 'an admin', user: adminUser, pins: true },
  ])('$scenario pins a thread: $pins', ({ user, pins }) => {
    expect(canPinThread({ user, thread })).toBe(pins);
  });

  it.each<{ scenario: string; user: UserContext | null; deletes: boolean }>([
    { scenario: 'an unauthenticated caller', user: guestUser, deletes: false },
    { scenario: 'the owning creator', user: creatorUser, deletes: false },
    { scenario: 'its author', user: { id: 'fan-1', role: 'USER' }, deletes: true },
  ])('$scenario deletes a thread: $deletes', ({ user, deletes }) => {
    expect(canDeleteThread({ user, thread })).toBe(deletes);
  });
});

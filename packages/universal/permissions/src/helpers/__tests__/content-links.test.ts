import { adminUser, creatorUser, guestUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import {
  canActOnContentLink,
  canReadContentLinkStats,
  canSuggestContentLink,
} from '../content-links';

const channel = { ownerId: creatorUser.id, channelId: 'chan-creator-1' };

const member = (role: 'editor' | 'moderator' | 'manager'): UserContext => ({
  id: `member-${role}`,
  role: 'USER',
  memberships: { 'chan-creator-1': { role, ownerId: creatorUser.id } },
});

describe('helpers/content-links', () => {
  it.each<{ scenario: string; user: UserContext | null; links: boolean; approves: boolean }>([
    { scenario: 'an unauthenticated caller', user: guestUser, links: false, approves: false },
    { scenario: 'the owning creator', user: creatorUser, links: true, approves: true },
    { scenario: 'another user', user: standardUser, links: false, approves: false },
    { scenario: 'an editor', user: member('editor'), links: true, approves: false },
    { scenario: 'a moderator', user: member('moderator'), links: false, approves: false },
    { scenario: 'a manager', user: member('manager'), links: true, approves: true },
    { scenario: 'an admin', user: adminUser, links: true, approves: true },
  ])('$scenario links: $links, approves: $approves', ({ user, links, approves }) => {
    expect(canActOnContentLink({ user, action: 'link', channel })).toBe(links);
    expect(canActOnContentLink({ user, action: 'approveLink', channel })).toBe(approves);
  });

  it.each([
    { scenario: 'a guest', user: guestUser, expected: false },
    { scenario: 'a signed-in viewer', user: standardUser, expected: true },
  ])('$scenario suggests: $expected', ({ user, expected }) => {
    expect(canSuggestContentLink({ user })).toBe(expected);
  });

  it('lets the owner read link stats and nobody outside the channel', () => {
    expect(canReadContentLinkStats({ user: creatorUser, channel })).toBe(true);
    expect(canReadContentLinkStats({ user: standardUser, channel })).toBe(false);
  });
});

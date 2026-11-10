import { adminUser, creatorUser, moderatorUser, standardUser } from '../../__mocks__/fixtures';
import type { UserContext } from '../../types/index';
import {
  canModerateComment,
  canReadCommentSettings,
  canRestrictChannelUser,
  canUpdateCommentSettings,
  isChannelTeamMember,
} from '../comment-moderation';

const CHANNEL_ID = 'chan-1';
const OWNER_ID = creatorUser.id;
const channel = { channelId: CHANNEL_ID, ownerId: OWNER_ID };

const memberAs = (role: 'manager' | 'moderator' | 'editor'): UserContext => ({
  id: `member-${role}`,
  role: 'USER',
  memberships: { [CHANNEL_ID]: { role, ownerId: OWNER_ID } },
});

const ACTIONS = ['hold', 'approve', 'hide', 'unhide', 'remove'] as const;

describe('helpers/comment-moderation: who may moderate a channel', () => {
  it.each(
    ACTIONS.flatMap((action) => [
      { action, scenario: 'the owner', user: creatorUser, expected: true },
      { action, scenario: 'a moderator member', user: memberAs('moderator'), expected: true },
      { action, scenario: 'an editor member', user: memberAs('editor'), expected: false },
      { action, scenario: 'the platform moderator', user: moderatorUser, expected: false },
      { action, scenario: 'an admin', user: adminUser, expected: true },
      { action, scenario: 'a stranger', user: standardUser, expected: false },
      { action, scenario: 'an anonymous caller', user: null, expected: false },
    ])
  )('lets $scenario $action a comment: $expected', ({ action, user, expected }) => {
    expect(canModerateComment({ user, action, videoOwnerId: OWNER_ID })).toBe(expected);
  });

  it.each([
    { scenario: 'the owner', user: creatorUser, restrict: true, settings: true },
    { scenario: 'a manager', user: memberAs('manager'), restrict: true, settings: true },
    { scenario: 'a moderator', user: memberAs('moderator'), restrict: true, settings: false },
    { scenario: 'an editor', user: memberAs('editor'), restrict: false, settings: false },
    { scenario: 'a stranger', user: standardUser, restrict: false, settings: false },
    { scenario: 'an anonymous caller', user: null, restrict: false, settings: false },
  ])(
    'gives $scenario restrict $restrict and settings $settings',
    ({ user, restrict, settings }) => {
      expect(canRestrictChannelUser({ user, channel })).toBe(restrict);
      expect(canUpdateCommentSettings({ user, channel })).toBe(settings);
      expect(canReadCommentSettings({ user, channel })).toBe(settings);
    }
  );

  it.each([
    { scenario: 'the owner', user: creatorUser, expected: true },
    { scenario: 'a member of the channel', user: memberAs('editor'), expected: true },
    {
      scenario: 'a member of another channel',
      user: {
        id: 'x',
        role: 'USER',
        memberships: { other: { role: 'manager', ownerId: 'o2' } },
      } as UserContext,
      expected: false,
    },
    { scenario: 'a stranger', user: standardUser, expected: false },
    { scenario: 'an anonymous caller', user: null, expected: false },
  ])('counts $scenario as team: $expected', ({ user, expected }) => {
    expect(isChannelTeamMember({ user, ...channel })).toBe(expected);
  });
});

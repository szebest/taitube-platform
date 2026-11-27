import { subject } from '@casl/ability';
import type { AppAction, AppSubjects, UserContext } from '../../types/index';
import { defineCommentModerationRules } from '../comment-moderation.rules';
import { buildAbility } from './build-ability';
import { matrixCells } from './channel-matrix';

const CHANNEL_ID = 'chan-1';
const OWNER_ID = 'owner-1';

const channelUser = subject('ChannelUser', { channelId: CHANNEL_ID, ownerId: OWNER_ID });
const settings = subject('CommentSettings', { channelId: CHANNEL_ID, ownerId: OWNER_ID });
const owner: UserContext = { id: OWNER_ID, role: 'CREATOR' };
const memberOf = (role: 'manager' | 'moderator' | 'editor'): UserContext => ({
  id: `member-${role}`,
  role: 'USER',
  memberships: { [CHANNEL_ID]: { role, ownerId: OWNER_ID } },
});

describe('rules/comment-moderation.rules: who restricts users and sets comment rules', () => {
  it.each<{
    scenario: string;
    user: UserContext | null;
    action: AppAction;
    target: AppSubjects;
    expected: boolean;
  }>([
    {
      scenario: 'a guest restricts a user',
      user: null,
      action: 'restrict',
      target: channelUser,
      expected: false,
    },
    {
      scenario: 'a guest reads the settings',
      user: null,
      action: 'read',
      target: settings,
      expected: false,
    },
    {
      scenario: 'the owner restricts a user',
      user: owner,
      action: 'restrict',
      target: channelUser,
      expected: true,
    },
    {
      scenario: 'the owner edits the settings',
      user: owner,
      action: 'update',
      target: settings,
      expected: true,
    },
    {
      scenario: 'a moderator restricts a user',
      user: memberOf('moderator'),
      action: 'restrict',
      target: channelUser,
      expected: true,
    },
    {
      scenario: 'a moderator edits the settings',
      user: memberOf('moderator'),
      action: 'update',
      target: settings,
      expected: false,
    },
    {
      scenario: 'a moderator reads the settings',
      user: memberOf('moderator'),
      action: 'read',
      target: settings,
      expected: false,
    },
    {
      scenario: 'a manager edits the settings',
      user: memberOf('manager'),
      action: 'update',
      target: settings,
      expected: true,
    },
    {
      scenario: 'an editor restricts a user',
      user: memberOf('editor'),
      action: 'restrict',
      target: channelUser,
      expected: false,
    },
    {
      scenario: 'a manager of another channel restricts a user here',
      user: { id: 'x', role: 'USER', memberships: { other: { role: 'manager', ownerId: 'o2' } } },
      action: 'restrict',
      target: channelUser,
      expected: false,
    },
  ])('$scenario: $expected', ({ user, action, target, expected }) => {
    expect(buildAbility(defineCommentModerationRules, user).can(action, target)).toBe(expected);
  });

  it.each([...matrixCells('ChannelUser'), ...matrixCells('CommentSettings')])(
    'the channel matrix: $persona holding $capability may $action: $expected',
    ({ user, action, target, expected }) => {
      expect(buildAbility(defineCommentModerationRules, user).can(action, target)).toBe(expected);
    }
  );
});

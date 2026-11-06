import { subject } from '@casl/ability';
import type { ChannelRole } from '@vp/domain';
import type { AppAction, AppSubjects, UserContext } from '../../types/index';
import { defineChannelTeamRules } from '../channel-team.rules';
import { buildAbility } from './build-ability';
import { matrixCells } from './channel-matrix';

const CHANNEL_ID = 'chan-1';
const OWNER_ID = 'owner-1';

const manager: UserContext = {
  id: 'manager-1',
  role: 'USER',
  memberships: { [CHANNEL_ID]: { role: 'manager', ownerId: OWNER_ID } },
};

const memberWith = (userId: string, role: ChannelRole) =>
  subject('ChannelMember', { channelId: CHANNEL_ID, ownerId: OWNER_ID, userId, role });

describe('rules/channel-team.rules: who runs a channel team', () => {
  it.each<{
    scenario: string;
    user: UserContext | null;
    action: AppAction;
    target: AppSubjects;
    expected: boolean;
  }>([
    {
      scenario: 'a manager changes another manager',
      user: manager,
      action: 'update',
      target: memberWith('manager-2', 'manager'),
      expected: false,
    },
    {
      scenario: 'a manager removes another manager',
      user: manager,
      action: 'delete',
      target: memberWith('manager-2', 'manager'),
      expected: false,
    },
    {
      scenario: 'a manager invites a manager',
      user: manager,
      action: 'create',
      target: subject('ChannelInvite', {
        channelId: CHANNEL_ID,
        ownerId: OWNER_ID,
        inviteeUserId: 'invitee-1',
        role: 'manager' as const,
      }),
      expected: false,
    },
    {
      scenario: 'the owner changes a manager',
      user: { id: OWNER_ID, role: 'USER' },
      action: 'update',
      target: memberWith('manager-2', 'manager'),
      expected: true,
    },
    {
      scenario: 'a member leaves',
      user: { id: 'editor-1', role: 'USER' },
      action: 'delete',
      target: memberWith('editor-1', 'editor'),
      expected: true,
    },
    {
      scenario: 'the invitee answers their invite',
      user: { id: 'invitee-1', role: 'USER' },
      action: 'update',
      target: subject('ChannelInvite', {
        channelId: CHANNEL_ID,
        ownerId: OWNER_ID,
        inviteeUserId: 'invitee-1',
        role: 'editor' as const,
      }),
      expected: true,
    },
    {
      scenario: 'a guest reads the audit log',
      user: null,
      action: 'read',
      target: subject('ChannelAudit', { channelId: CHANNEL_ID, ownerId: OWNER_ID }),
      expected: false,
    },
  ])('$scenario: $expected', ({ user, action, target, expected }) => {
    expect(buildAbility(defineChannelTeamRules, user).can(action, target)).toBe(expected);
  });

  it.each(matrixCells('Team'))(
    'the channel matrix: $persona holding $capability may $action: $expected',
    ({ user, action, target, expected }) => {
      expect(buildAbility(defineChannelTeamRules, user).can(action, target)).toBe(expected);
    }
  );
});

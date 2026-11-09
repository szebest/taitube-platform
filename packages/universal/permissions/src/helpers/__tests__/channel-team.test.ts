import type { ChannelRole } from '@vp/domain';
import type { UserContext } from '../../types/index';
import {
  canAnswerChannelInvite,
  canChangeChannelMember,
  canInviteChannelMember,
  canReadChannelAudit,
  canReadChannelTeam,
  canRemoveChannelMember,
  canRevokeChannelInvite,
} from '../channel-team';

const CHANNEL = { channelId: 'chan-1', ownerId: 'owner-1' };

const owner: UserContext = { id: CHANNEL.ownerId, role: 'USER' };
const memberAs = (role: ChannelRole): UserContext => ({
  id: `${role}-1`,
  role: 'USER',
  memberships: { [CHANNEL.channelId]: { role, ownerId: CHANNEL.ownerId } },
});
const outsider: UserContext = { id: 'outsider-1', role: 'USER' };

const invite = (role: ChannelRole) => ({ ...CHANNEL, inviteeUserId: 'invitee-1', role });
const member = (userId: string, role: ChannelRole) => ({ ...CHANNEL, userId, role });

describe('helpers/channel-team', () => {
  it.each<{ scenario: string; ask: (user: UserContext | null) => boolean; allowed: string[] }>([
    {
      scenario: 'read the team',
      ask: (user) => canReadChannelTeam({ user, channel: CHANNEL }),
      allowed: ['owner', 'manager'],
    },
    {
      scenario: 'read the audit log',
      ask: (user) => canReadChannelAudit({ user, channel: CHANNEL }),
      allowed: ['owner', 'manager'],
    },
    {
      scenario: 'invite an editor',
      ask: (user) => canInviteChannelMember({ user, invite: invite('editor') }),
      allowed: ['owner', 'manager'],
    },
    {
      scenario: 'invite a manager',
      ask: (user) => canInviteChannelMember({ user, invite: invite('manager') }),
      allowed: ['owner'],
    },
    {
      scenario: 'revoke an editor invite',
      ask: (user) => canRevokeChannelInvite({ user, invite: invite('editor') }),
      allowed: ['owner', 'manager'],
    },
    {
      scenario: 'answer an invite to someone else',
      ask: (user) => canAnswerChannelInvite({ user, invite: invite('editor') }),
      allowed: ['owner', 'manager'],
    },
    {
      scenario: 'change an editor',
      ask: (user) => canChangeChannelMember({ user, member: member('editor-2', 'editor') }),
      allowed: ['owner', 'manager'],
    },
    {
      scenario: 'give a member the manager role',
      ask: (user) => canChangeChannelMember({ user, member: member('editor-2', 'manager') }),
      allowed: ['owner'],
    },
    {
      scenario: 'remove an analytics viewer',
      ask: (user) => canRemoveChannelMember({ user, member: member('analytics-2', 'analytics') }),
      allowed: ['owner', 'manager'],
    },
  ])('$scenario: only $allowed', ({ ask, allowed }) => {
    const personas: [string, UserContext | null][] = [
      ['owner', owner],
      ['manager', memberAs('manager')],
      ['editor', memberAs('editor')],
      ['moderator', memberAs('moderator')],
      ['analytics', memberAs('analytics')],
      ['outsider', outsider],
      ['anonymous', null],
    ];

    expect(personas.filter(([, user]) => ask(user)).map(([name]) => name)).toEqual(allowed);
  });

  it.each<{ scenario: string; ask: () => boolean }>([
    {
      scenario: 'the invitee answers their own invite',
      ask: () =>
        canAnswerChannelInvite({
          user: { id: 'invitee-1', role: 'USER' },
          invite: invite('manager'),
        }),
    },
    {
      scenario: 'an editor leaves',
      ask: () =>
        canRemoveChannelMember({ user: memberAs('editor'), member: member('editor-1', 'editor') }),
    },
    {
      scenario: 'a manager leaves',
      ask: () =>
        canRemoveChannelMember({
          user: memberAs('manager'),
          member: member('manager-1', 'manager'),
        }),
    },
  ])('$scenario', ({ ask }) => {
    expect(ask()).toBe(true);
  });
});

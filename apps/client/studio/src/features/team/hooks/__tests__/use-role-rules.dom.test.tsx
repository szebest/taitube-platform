import { renderHook } from '@testing-library/react';
import { CHANNEL_ROLE_NAMES, type ChannelRole } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { PermissionsProvider } from '@vp/permissions-react';
import type { PropsWithChildren } from 'react';
import { ActiveChannelContext, type ActiveChannel } from '#app/hooks/use-active-channel';
import { useRoleRules } from '../use-role-rules';

const CHANNEL = { channelId: 'channel-1', ownerId: 'owner-1' };

function rulesOf(acting: 'owner' | 'manager') {
  const viewer: UserContext =
    acting === 'owner'
      ? { id: CHANNEL.ownerId, role: 'CREATOR' }
      : {
          id: 'manager-1',
          role: 'USER',
          memberships: { [CHANNEL.channelId]: { ownerId: CHANNEL.ownerId, role: 'manager' } },
        };
  const active: ActiveChannel = {
    ...CHANNEL,
    role: acting,
    own: acting === 'owner',
    memberships: [],
  };
  const wrapper = ({ children }: PropsWithChildren) => (
    <ActiveChannelContext value={active}>
      <PermissionsProvider userContext={viewer}>{children}</PermissionsProvider>
    </ActiveChannelContext>
  );
  return renderHook(useRoleRules, { wrapper }).result.current;
}

const allowed = (rule: (role: ChannelRole) => boolean) => CHANNEL_ROLE_NAMES.filter(rule);

describe('apps/client/studio: useRoleRules', () => {
  it('lets the owner give, invite and revoke every role and remove every member', () => {
    const rules = rulesOf('owner');

    expect(allowed(rules.canInvite)).toEqual(CHANNEL_ROLE_NAMES);
    expect(allowed(rules.canAssign)).toEqual(CHANNEL_ROLE_NAMES);
    expect(allowed(rules.canRevoke)).toEqual(CHANNEL_ROLE_NAMES);
    expect(allowed((role) => rules.canRemove('member-1', role))).toEqual(CHANNEL_ROLE_NAMES);
  });

  it('keeps a manager from every manager: not to invite, give, revoke or remove', () => {
    const rules = rulesOf('manager');

    expect(allowed(rules.canInvite)).not.toContain('manager');
    expect(allowed(rules.canAssign)).not.toContain('manager');
    expect(allowed(rules.canRevoke)).not.toContain('manager');
    expect(allowed((role) => rules.canRemove('member-1', role))).not.toContain('manager');
    expect(allowed(rules.canInvite)).toEqual(['editor', 'moderator', 'analytics']);
  });
});

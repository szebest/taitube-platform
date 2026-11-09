import type { ChannelMemberView } from '@vp/api-contracts';
import { CHANNEL_ROLE_NAMES } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { fromPromise, isOk } from '@vp/result';
import { Select, useToast } from '@vp/ui';
import { RoleBadge } from '#app/components/team/role-badge';
import { useRoleRules } from '#app/features/team/hooks/use-role-rules';
import { useChangeMemberRole } from '#app/features/team/hooks/use-team-mutations';

export interface MemberRoleCellProps {
  member: ChannelMemberView;
  name: string;
}

/** A member's role as a select over the roles the viewer may give; a role the viewer may not touch is a label. */
export function MemberRoleCell({ member, name }: MemberRoleCellProps) {
  const { tOr } = useT();
  const toast = useToast();
  const { canAssign } = useRoleRules();
  const change = useChangeMemberRole();

  if (!canAssign(member.role)) {
    return (
      <RoleBadge channelRole={member.role}>
        {tOr('studio.teamRole', { role: member.role }, '')}
      </RoleBadge>
    );
  }

  return (
    <Select.Root
      value={member.role}
      disabled={change.isPending}
      onValueChange={async (next) => {
        const role = CHANNEL_ROLE_NAMES.find((known) => known === next);
        if (!role || role === member.role) return;

        const changed = await fromPromise(
          () => change.mutateAsync({ userId: member.userId, role }),
          (cause) => cause
        );
        if (!isOk(changed)) {
          toast({ tone: 'danger', title: tOr('studio.teamRoleChangeFailed', {}, '') });
        }
      }}
    >
      <Select.Trigger size="sm" aria-label={tOr('studio.teamRoleOf', { name }, '')}>
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        {CHANNEL_ROLE_NAMES.filter(canAssign).map((role) => (
          <Select.Item key={role} value={role}>
            {tOr('studio.teamRole', { role }, '')}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

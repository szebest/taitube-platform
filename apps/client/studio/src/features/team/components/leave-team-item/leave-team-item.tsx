import type { ChannelMembershipView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { canRemoveChannelMember } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useAccount } from '@vp/queries';
import { DropdownMenu } from '@vp/ui';

export interface LeaveTeamItemProps {
  membership: ChannelMembershipView;
  onLeave: () => void;
}

/** The menu entry that leaves a team the viewer works on, for a viewer the rules let remove themselves from it. */
export function LeaveTeamItem({ membership, onLeave }: LeaveTeamItemProps) {
  const { tOr } = useT();
  const account = useAccount();
  const { channelId, ownerId, role } = membership;
  const mayLeave = useCan(canRemoveChannelMember, {
    member: { channelId, ownerId, role, userId: account?.user.id },
  });

  if (!mayLeave) {
    return null;
  }

  return (
    <>
      <DropdownMenu.Separator />
      <DropdownMenu.Item onSelect={onLeave}>{tOr('studio.teamLeave', {}, '')}</DropdownMenu.Item>
    </>
  );
}

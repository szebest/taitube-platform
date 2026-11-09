import type { ChannelMembershipView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useAccount } from '@vp/queries';
import { fromPromise, isOk } from '@vp/result';
import { AlertDialog, Button, useToast, useUiCopy } from '@vp/ui';
import { useLeaveTeam } from '#app/features/team/hooks/use-leave-team';

export interface LeaveTeamDialogProps {
  membership: ChannelMembershipView;
  onClose: () => void;
}

/** Asks before the viewer leaves a team they work on; they lose its studio at once and land on their own channel. */
export function LeaveTeamDialog({ membership, onClose }: LeaveTeamDialogProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const toast = useToast();
  const account = useAccount();
  const leave = useLeaveTeam();
  const name = membership.channel.displayName;

  const confirm = async () => {
    if (!account) return;
    const left = await fromPromise(
      () => leave.mutateAsync(account.user.id),
      (cause) => cause
    );
    toast(
      isOk(left)
        ? { tone: 'success', title: tOr('studio.teamLeft', { name }, '') }
        : { tone: 'danger', title: tOr('studio.teamLeaveFailed', {}, '') }
    );
  };

  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Content size="sm">
        <AlertDialog.Title>{tOr('studio.teamLeaveTitle', { name }, '')}</AlertDialog.Title>
        <AlertDialog.Description>
          {tOr('studio.teamLeaveDescription', {}, '')}
        </AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="outline">{cancel}</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <Button variant="solid" tone="danger" onClick={confirm}>
              {tOr('studio.teamLeaveConfirm', {}, '')}
            </Button>
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

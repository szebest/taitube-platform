import type { ChannelMemberView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { fromPromise, isOk } from '@vp/result';
import { AlertDialog, Button, useToast, useUiCopy } from '@vp/ui';
import { useRemoveMember } from '#app/features/team/hooks/use-team-mutations';

export interface RemoveMemberDialogProps {
  member: ChannelMemberView;
  name: string;
  onClose: () => void;
}

/** Asks before taking a member off the team; they lose the studio at once. */
export function RemoveMemberDialog({ member, name, onClose }: RemoveMemberDialogProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const toast = useToast();
  const remove = useRemoveMember();

  const confirm = async () => {
    const removed = await fromPromise(
      () => remove.mutateAsync(member.userId),
      (cause) => cause
    );
    toast(
      isOk(removed)
        ? { tone: 'success', title: tOr('studio.teamRemoved', { name }, '') }
        : { tone: 'danger', title: tOr('studio.teamRemoveFailed', {}, '') }
    );
  };

  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Content size="sm">
        <AlertDialog.Title>{tOr('studio.teamRemoveTitle', { name }, '')}</AlertDialog.Title>
        <AlertDialog.Description>
          {tOr('studio.teamRemoveDescription', {}, '')}
        </AlertDialog.Description>
        <AlertDialog.Footer>
          <AlertDialog.Cancel asChild>
            <Button variant="outline">{cancel}</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <Button variant="solid" tone="danger" onClick={confirm}>
              {tOr('studio.teamRemoveConfirm', {}, '')}
            </Button>
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

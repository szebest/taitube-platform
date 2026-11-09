import { ApiError } from '@vp/api-client';
import { CHANNEL_ROLE_NAMES, type ChannelRole } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { useT } from '@vp/intl-react';
import { fromPromise, isOk } from '@vp/result';
import { Button, Dialog, Field, SegmentedControl, useToast, useUiCopy } from '@vp/ui';
import { type FormEvent, useState } from 'react';
import { useRoleRules } from '#app/features/team/hooks/use-role-rules';
import { useInviteMember } from '#app/features/team/hooks/use-team-mutations';
import { type FoundChannel, HandleLookup } from '../handle-lookup/handle-lookup';
import { RoleCapabilities } from '../role-capabilities/role-capabilities';

export interface InviteDialogProps {
  onClose: () => void;
}

type Refusal =
  | 'studio.teamInviteAlreadyMember'
  | 'studio.teamInviteAlreadyPending'
  | 'studio.teamInviteNoChannel';

function refusalOf(error: unknown): Refusal | undefined {
  if (!(error instanceof ApiError)) return undefined;
  switch (error.code) {
    case ErrorCodes.CHANNEL_MEMBER_EXISTS:
      return 'studio.teamInviteAlreadyMember';
    case ErrorCodes.CHANNEL_INVITE_ALREADY_PENDING:
      return 'studio.teamInviteAlreadyPending';
    case ErrorCodes.CHANNEL_NOT_FOUND:
      return 'studio.teamInviteNoChannel';
    default:
      return undefined;
  }
}

/** Invites the channel behind a handle with a role; a manager is offered every role but manager. */
export function InviteDialog({ onClose }: InviteDialogProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const toast = useToast();
  const invite = useInviteMember();
  const { canInvite } = useRoleRules();
  const [chosen, setChosen] = useState<FoundChannel>();
  const [role, setRole] = useState<ChannelRole>('editor');
  const [refusal, setRefusal] = useState<Refusal>();

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!chosen) return;

    const sent = await fromPromise(
      () => invite.mutateAsync({ handle: chosen.handle, role }),
      (cause) => cause
    );
    if (isOk(sent)) {
      toast({
        tone: 'success',
        title: tOr('studio.teamInviteSent', { name: chosen.displayName }, ''),
      });
      onClose();
      return;
    }

    const known = refusalOf(sent.error);
    if (known) {
      setRefusal(known);
      return;
    }
    toast({ tone: 'danger', title: tOr('studio.teamInviteFailed', {}, '') });
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content size="md">
        <form onSubmit={send}>
          <Dialog.Header>
            <Dialog.Title>{tOr('studio.teamInviteTitle', {}, '')}</Dialog.Title>
            <Dialog.Description>{tOr('studio.teamInviteDescription', {}, '')}</Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
            <Field.Root invalid={refusal !== undefined}>
              <span className="text-label">{tOr('studio.teamInviteHandle', {}, '')}</span>
              <HandleLookup
                onPick={(channel) => {
                  setChosen(channel);
                  setRefusal(undefined);
                }}
              />
              {chosen && !refusal && (
                <Field.Hint>
                  {tOr(
                    'studio.teamInviteChosen',
                    { name: chosen.displayName, handle: chosen.handle },
                    ''
                  )}
                </Field.Hint>
              )}
              {refusal && <Field.Error>{tOr(refusal, {}, '')}</Field.Error>}
            </Field.Root>
            <Field.Root>
              <span className="text-label">{tOr('studio.teamInviteRole', {}, '')}</span>
              <SegmentedControl.Root
                aria-label={tOr('studio.teamInviteRole', {}, '')}
                value={role}
                onValueChange={(next) => {
                  const known = CHANNEL_ROLE_NAMES.find((name) => name === next);
                  if (known) setRole(known);
                }}
              >
                {CHANNEL_ROLE_NAMES.map((name) => (
                  <SegmentedControl.Item key={name} value={name} disabled={!canInvite(name)}>
                    {tOr('studio.teamRole', { role: name }, '')}
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
              <Field.Hint>{tOr('studio.teamRoleSummary', { role }, '')}</Field.Hint>
            </Field.Root>
            <RoleCapabilities role={role} />
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="outline" type="button" onClick={onClose}>
              {cancel}
            </Button>
            <Button
              variant="solid"
              tone="accent"
              type="submit"
              disabled={!chosen}
              loading={invite.isPending}
            >
              {tOr('studio.teamInviteSend', {}, '')}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

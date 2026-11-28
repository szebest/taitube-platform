import { Button, Chip, Field, Icon, useToast } from '@kit/ui';
import type { PlaylistCollaboratorRole } from '@vp/domain';
import { failureCode, present } from '@vp/queries';
import { type FormEvent, useId, useState } from 'react';
import {
  ChannelPicker,
  type PickedChannel,
} from '#app/features/library/components/channel-picker/channel-picker';
import { useCollaboratorChanges } from '#app/features/library/hooks/use-collaborator-changes';
import { useT } from '#app/lib/messages';
import { RoleSelect } from '../role-select/role-select';

export interface InviteHandleFormProps {
  playlistId: string;
}

/** Finds a channel, picks a role and invites the person behind it; a refusal shows under the form. */
export function InviteHandleForm({ playlistId }: InviteHandleFormProps) {
  const [picked, setPicked] = useState<PickedChannel | null>(null);
  const [role, setRole] = useState<PlaylistCollaboratorRole>('contributor');
  const titleId = useId();
  const { tOr } = useT();
  const showToast = useToast();
  const { invite } = useCollaboratorChanges(playlistId);

  const problem = invite.isError
    ? tOr(present({ code: failureCode(invite.error) }).copy, {}, '')
    : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (picked === null) {
      return;
    }

    invite.mutate(
      { handle: picked.handle, role },
      {
        onSuccess: () => {
          showToast({
            tone: 'success',
            title: tOr('playlistPeople.invited', { name: picked.displayName }, ''),
          });
          setPicked(null);
        },
      }
    );
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby={titleId}
      className="flex flex-col gap-stack"
    >
      <h3 id={titleId} className="m-0 text-title">
        {tOr('playlistPeople.inviteHandleTitle', {}, '')}
      </h3>
      <Field.Root invalid={problem !== null}>
        <Field.Label>{tOr('playlistPeople.handleLabel', {}, '')}</Field.Label>
        {picked ? (
          <Chip
            onClick={() => setPicked(null)}
            aria-label={tOr('playlistTools.removeChannel', { name: picked.displayName }, '')}
            className="self-start"
          >
            {picked.displayName}
            <Icon name="close" size="sm" />
          </Chip>
        ) : (
          <ChannelPicker label={tOr('playlistPeople.handleLabel', {}, '')} onPick={setPicked} />
        )}
        {problem && <Field.Error>{problem}</Field.Error>}
      </Field.Root>
      <div className="flex flex-wrap items-end gap-stack">
        <RoleSelect value={role} onChange={setRole} />
        <Button
          type="submit"
          variant="solid"
          tone="accent"
          disabled={picked === null}
          loading={invite.isPending}
        >
          {tOr('playlistPeople.sendInvite', {}, '')}
        </Button>
      </div>
    </form>
  );
}
